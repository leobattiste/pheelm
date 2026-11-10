begin;
do $$
declare account_id uuid := '00000000-0000-0000-0000-000000000099';
begin
  insert into public.profiles(id,handle,is_owner,bio) values(account_id,'leo',true,repeat('paragraph ',1000));
  if (select char_length(bio) from public.member_profiles where id=account_id) <> 10000 then
    raise exception 'Long bio was not mirrored in full';
  end if;
  begin
    update public.profiles set handle='another_owner' where id=account_id;
    raise exception 'Non-leo owner incorrectly accepted a long bio';
  exception when check_violation then null; end;
  begin
    update public.profiles set is_owner=false where id=account_id;
    raise exception 'Non-owner leo incorrectly accepted a long bio';
  exception when check_violation then null; end;
  update public.profiles set bio=repeat('x',150),handle='ordinary',is_owner=false where id=account_id;
  begin
    update public.profiles set bio=repeat('x',151) where id=account_id;
    raise exception 'Ordinary bio exceeded 150 characters';
  exception when check_violation then null; end;
  update public.profiles set handle='leo',is_owner=true,bio=repeat('x',10000),is_private=true where id=account_id;
  if (select bio is not null from public.member_profiles where id=account_id) then
    raise exception 'Private bio leaked to public mirror';
  end if;
end $$;
rollback;
