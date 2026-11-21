CREATE TABLE request_limits (
  scope text NOT NULL,
  identity_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0),
  PRIMARY KEY (scope, identity_hash, window_start)
);

CREATE INDEX request_limits_expiry ON request_limits(window_start);
