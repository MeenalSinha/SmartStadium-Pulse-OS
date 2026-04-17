/**
 * Recharts wrapper — insulates the rest of the app from recharts API changes.
 *
 * If recharts is ever swapped or its API changes, only this file needs updating.
 * All chart imports across pages go through here, never directly from 'recharts'.
 */
export {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
