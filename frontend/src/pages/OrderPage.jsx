import React, { useState, useEffect, useRef } from "react";
import { api } from "../services/api";

// FIX: stable item prices — computed once, not on every render via Math.random()
const ITEM_PRICES = {
  "Classic Burger": 7,
  Fries: 4,
  Soda: 3,
  Margherita: 9,
  Pepperoni: 10,
  "BBQ Chicken": 11,
  Nachos: 5,
  "Hot Dog": 5,
  Popcorn: 4,
  Cola: 3,
  Water: 2,
  "Energy Drink": 4,
};

function getPrice(name) {
  return ITEM_PRICES[name] ?? 5;
}

export default function OrderPage({ onPointsEarned }) {
  const [stalls, setStalls] = useState([]);
  const [selected, setSelected] = useState(null);
  const [cart, setCart] = useState([]);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [orderError, setOrderError] = useState(null);
  // FIX: track initial auto-select so we don't override user choice on polling
  const hasAutoSelected = useRef(false);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const data = await api.getQueue();
        setStalls(data.stalls);
        setFetchError(null);
        if (!hasAutoSelected.current && data.recommended) {
          setSelected(data.recommended.id);
          hasAutoSelected.current = true;
        }
      } catch (e) {
        setFetchError("Unable to load stalls. Is the backend running?");
      }
    };
    fetchQueue();
    const iv = setInterval(fetchQueue, 3000);
    return () => clearInterval(iv);
  }, []);

  const selectedStall = stalls.find((s) => s.id === selected);

  const addItem = (item) =>
    setCart((prev) => {
      const exists = prev.find((c) => c.name === item);
      if (exists)
        return prev.map((c) =>
          c.name === item ? { ...c, qty: c.qty + 1 } : c,
        );
      return [...prev, { name: item, qty: 1, price: getPrice(item) }];
    });

  const removeItem = (item) =>
    setCart((prev) => {
      const exists = prev.find((c) => c.name === item);
      if (!exists) return prev;
      if (exists.qty === 1) return prev.filter((c) => c.name !== item);
      return prev.map((c) => (c.name === item ? { ...c, qty: c.qty - 1 } : c));
    });

  const placeOrder = async () => {
    if (!selected || cart.length === 0 || loading) return;
    setLoading(true);
    setOrderError(null);
    try {
      const items = cart.map((c) => `${c.qty}x ${c.name}`);
      // FIX: use a real user ID from context; for now a stable session identifier
      const userId =
        sessionStorage.getItem("stadiumUserId") ||
        (() => {
          const id = `fan_${Math.random().toString(36).slice(2, 9)}`;
          sessionStorage.setItem("stadiumUserId", id);
          return id;
        })();
      const result = await api.placeOrder(selected, items, userId);
      setOrder(result);
      setCart([]);
      if (onPointsEarned)
        onPointsEarned(result.pointsEarned, "Order placed via ZeroQueue");
    } catch (e) {
      setOrderError("Order failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const levelColor = {
    quiet: "var(--green)",
    moderate: "var(--yellow)",
    busy: "var(--red)",
  };
  const totalPrice = cart.reduce((a, c) => a + c.price * c.qty, 0);

  return (
    <div>
      <div className="section-title">ZeroQueue Ordering</div>
      <div className="section-desc">
        Skip the line — order from the least crowded stall
      </div>

      {fetchError && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            marginBottom: 16,
            background: "var(--red-light)",
            border: "1px solid #FCA5A5",
            fontSize: 13,
            color: "var(--red)",
          }}
        >
          {fetchError}
        </div>
      )}

      {order && (
        <div
          style={{
            padding: "16px 20px",
            borderRadius: "var(--radius-lg)",
            marginBottom: 20,
            background: "var(--green-light)",
            border: "1px solid #6EE7B7",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--green)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
            >
              <path d="M2 8l4 4 8-8" />
            </svg>
          </div>
          <div>
            <div
              style={{ fontWeight: 700, color: "var(--green)", fontSize: 14 }}
            >
              Order Confirmed — {order.stallName}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                marginTop: 2,
              }}
            >
              Ready in {order.waitTime} minutes — Zone {order.zone} — +
              {order.pointsEarned} points earned
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: "auto" }}
            onClick={() => setOrder(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid-2-1">
        <div>
          <div className="card mb-4">
            <div className="card-header">
              <div className="card-title">Available Stalls</div>
              <div className="card-subtitle">AI-ranked by wait time</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {stalls.map((stall, i) => (
                <div
                  key={stall.id}
                  className={`stall-card${selected === stall.id ? " selected" : ""}`}
                  onClick={() => {
                    setSelected(stall.id);
                    setCart([]);
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      {i === 0 && (
                        <span
                          className="badge badge-green"
                          style={{ fontSize: 10 }}
                        >
                          Best Pick
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {stall.name}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: levelColor[stall.level],
                      }}
                    >
                      {stall.waitTime} min
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 6,
                    }}
                  >
                    <div className="density-bar-wrap" style={{ flex: 1 }}>
                      <div
                        className={`density-bar ${stall.level === "quiet" ? "low" : stall.level === "moderate" ? "moderate" : "critical"}`}
                        style={{ width: `${Math.round(stall.density * 100)}%` }}
                      />
                    </div>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                      {Math.round(stall.density * 100)}%
                    </span>
                    <span
                      className={`badge badge-${stall.level === "quiet" ? "green" : stall.level === "moderate" ? "yellow" : "red"}`}
                      style={{ fontSize: 10 }}
                    >
                      {stall.level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedStall && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>
                {selectedStall.name} — Menu
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {selectedStall.menu?.map((item) => {
                  const cartItem = cart.find((c) => c.name === item);
                  const price = getPrice(item);
                  return (
                    <div
                      key={item}
                      style={{
                        padding: "10px 12px",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                        }}
                      >
                        {item}
                      </span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        {/* FIX: stable price, not random on each render */}
                        <span
                          style={{ fontSize: 12, color: "var(--text-muted)" }}
                        >
                          £{price}
                        </span>
                        {cartItem ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: "3px 8px" }}
                              onClick={() => removeItem(item)}
                            >
                              -
                            </button>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>
                              {cartItem.qty}
                            </span>
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: "3px 8px" }}
                              onClick={() => addItem(item)}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => addItem(item)}
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div
          className="card"
          style={{ alignSelf: "flex-start", position: "sticky", top: 76 }}
        >
          <div className="card-title" style={{ marginBottom: 14 }}>
            Your Order
          </div>

          {cart.length === 0 ? (
            <div className="empty-state" style={{ padding: "30px 0" }}>
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
              <p>Add items from the menu</p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                {cart.map((item) => (
                  <div
                    key={item.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 10px",
                      background: "var(--bg-surface)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-primary)",
                        fontWeight: 500,
                      }}
                    >
                      {item.qty}x {item.name}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      £{(item.price * item.qty).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: 12,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{ fontSize: 13, color: "var(--text-secondary)" }}
                  >
                    Subtotal
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    £{totalPrice.toFixed(2)}
                  </span>
                </div>
                {selectedStall && (
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Est. wait
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--green)",
                        fontWeight: 600,
                      }}
                    >
                      {selectedStall.waitTime} min
                    </span>
                  </div>
                )}
              </div>

              {orderError && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--red)",
                    marginBottom: 10,
                    padding: "8px 10px",
                    background: "var(--red-light)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  {orderError}
                </div>
              )}

              <button
                className="btn btn-primary w-full btn-lg"
                onClick={placeOrder}
                disabled={loading}
              >
                {loading
                  ? "Placing Order..."
                  : `Place Order — £${totalPrice.toFixed(2)}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
