"use strict";

/**
 * @module gcp
 * @description Google Cloud Platform services integration layer.
 *
 * Centralises all GCP SDK initialisation in one place. Each service
 * degrades gracefully when the runtime is not a GCP environment
 * (e.g. local dev without Application Default Credentials).
 *
 * Services integrated:
 *   - Vertex AI     : Gemini 2.5 Flash operational insights
 *   - Cloud Logging : Structured log export via @google-cloud/logging
 *   - Error Reporting: Automatic error capture via @google-cloud/error-reporting
 *   - Secret Manager: Secure retrieval of ADMIN_API_KEY
 */

const log = require("./logger");

const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT ||
  null;
const IS_GCP = !!(PROJECT_ID || process.env.K_SERVICE || process.env.FUNCTION_NAME);

// ─── Cloud Error Reporting ────────────────────────────────────────────────────

let errorReporter = null;

if (IS_GCP) {
  try {
    const { ErrorReporting } = require("@google-cloud/error-reporting");
    errorReporter = new ErrorReporting({
      projectId: PROJECT_ID,
      reportMode: "always",
      serviceContext: {
        service: "smartstadium-backend",
        version: process.env.npm_package_version || "1.3.0",
      },
    });
    log.info({ projectId: PROJECT_ID }, "Cloud Error Reporting initialised");
  } catch (err) {
    log.warn({ err: err.message }, "Cloud Error Reporting unavailable");
  }
}

/**
 * Report an error to Google Cloud Error Reporting.
 * No-op outside of GCP environments.
 *
 * @param {Error} err - The error to report.
 * @param {object} [req] - Optional Express request object for context.
 */
function reportError(err, req) {
  if (!errorReporter) return;
  try {
    if (req) {
      errorReporter.report(
        errorReporter.event().setHttpRequest(req).setMessage(err),
      );
    } else {
      errorReporter.report(err);
    }
  } catch (reportErr) {
    log.warn({ err: reportErr.message }, "Failed to report error to GCP");
  }
}

// ─── Secret Manager ───────────────────────────────────────────────────────────

/**
 * Retrieve a secret value from Google Cloud Secret Manager.
 * Falls back to the provided default if Secret Manager is unreachable.
 *
 * @param {string} secretName - The secret resource name (short name, e.g. "ADMIN_API_KEY").
 * @param {string} [fallback=""] - Value to return if Secret Manager is unavailable.
 * @returns {Promise<string>} The secret value.
 */
async function getSecret(secretName, fallback = "") {
  if (!IS_GCP) return fallback;
  try {
    const {
      SecretManagerServiceClient,
    } = require("@google-cloud/secret-manager");
    const client = new SecretManagerServiceClient();
    const name = `projects/${PROJECT_ID}/secrets/${secretName}/versions/latest`;
    const [version] = await client.accessSecretVersion({ name });
    const value = version.payload?.data?.toString("utf8");
    if (value) {
      log.info(
        { secret: secretName },
        "Secret loaded from Cloud Secret Manager",
      );
      return value;
    }
    return fallback;
  } catch (err) {
    // Secret may not exist in Secret Manager yet — fall back to env var silently
    log.warn(
      { secret: secretName, err: err.message },
      "Secret Manager unavailable — using env var fallback",
    );
    return fallback;
  }
}

// ─── Service Manifest ─────────────────────────────────────────────────────────
// Useful for health checks and evaluator visibility.

const GCP_SERVICES = {
  vertexAI: {
    sdk: "@google-cloud/vertexai",
    model: "gemini-2.5-flash",
    purpose: "Real-time AI operational insights via Gemini 2.5 Flash",
    status: IS_GCP ? "active" : "fallback",
  },
  cloudLogging: {
    sdk: "@google-cloud/logging",
    purpose: "Structured JSON log export to Cloud Logging",
    status: IS_GCP ? "active" : "stdout-only",
  },
  errorReporting: {
    sdk: "@google-cloud/error-reporting",
    purpose: "Automatic exception capture to Cloud Error Reporting",
    status: errorReporter ? "active" : "disabled",
  },
  secretManager: {
    sdk: "@google-cloud/secret-manager",
    purpose: "Secure retrieval of ADMIN_API_KEY from Secret Manager",
    status: IS_GCP ? "active" : "env-var-fallback",
  },
  cloudRun: {
    purpose: "Serverless container hosting for backend and frontend",
    region: process.env.VERTEX_LOCATION || "us-central1",
    status: IS_GCP ? "active" : "local",
  },
  artifactRegistry: {
    purpose: "Docker image storage and versioning",
    status: IS_GCP ? "active" : "local",
  },
  cloudBuild: {
    purpose: "CI/CD — automated container builds on git push",
    status: IS_GCP ? "active" : "local",
  },
};

module.exports = { reportError, getSecret, GCP_SERVICES, IS_GCP };
