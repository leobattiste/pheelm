-- Emails say "watchlist", like the rest of the site. Only the words members read change; template names
-- (collection-invitation) and the catalog's internal kind 'collection' stay as they are. Safe to run twice.
do $$
declare f regprocedure; def text; fixed text; n int := 0;
begin
 for f in select unnest(array['pheelm_email.account_event()'::regprocedure,'pheelm_email.notification_event()'::regprocedure,'pheelm_email.digest_message(timestamptz,timestamptz)'::regprocedure]) loop
  def := pg_get_functiondef(f);
  fixed := replace(replace(replace(replace(replace(replace(def,
   'make collections,','make watchlists,'),
   'curate a collection.','curate a watchlist.'),
   'curate your collection.','curate your watchlist.'),
   'membership of a collection changed','membership of a watchlist changed'),
   'your collection collaboration','your watchlist collaboration'),
   'else ''Collections'' end','else ''Watchlists'' end');
  if fixed <> def then execute fixed; n := n + 1; end if;
 end loop;
 raise notice 'Updated % functions', n;
end $$;
