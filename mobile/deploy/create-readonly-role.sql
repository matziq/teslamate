\set ON_ERROR_STOP on

SELECT format('CREATE ROLE teslamate_mobile LOGIN PASSWORD %L', :'mobile_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'teslamate_mobile')
\gexec
SELECT format('ALTER ROLE teslamate_mobile LOGIN PASSWORD %L', :'mobile_password')
\gexec
ALTER ROLE teslamate_mobile NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
ALTER ROLE teslamate_mobile SET default_transaction_read_only = on;
ALTER ROLE teslamate_mobile SET statement_timeout = '15s';
ALTER ROLE teslamate_mobile CONNECTION LIMIT 8;
GRANT CONNECT ON DATABASE teslamate TO teslamate_mobile;
GRANT USAGE ON SCHEMA public TO teslamate_mobile;
GRANT SELECT ON public.cars, public.drives, public.charging_processes, public.addresses, public.geofences TO teslamate_mobile;
