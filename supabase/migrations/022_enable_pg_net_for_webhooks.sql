-- HTTP asíncrono para webhooks y automatizaciones internas de Central GO.
-- Se mantiene fuera del navegador; las llamadas se ejecutan desde PostgreSQL.
create extension if not exists pg_net with schema extensions;
