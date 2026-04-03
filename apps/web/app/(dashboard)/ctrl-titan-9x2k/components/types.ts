export interface LogMessage {
  ts: string;
  level: string;
  msg: string;
  ctx?: Record<string, unknown>;
  err?: {
    name: string;
    message: string;
    stack?: string;
  };
}
