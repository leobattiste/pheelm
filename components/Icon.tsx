/**
 * Pheelm's icons, from Hugeicons (the free stroke set, 24×24 grid, 1.5 stroke).
 * Decorative by default (hidden from screen readers); pass `label` when the icon is the only
 * thing saying what something is.
 */
import {
  Add01Icon, ArrowUpDownIcon, DiceFaces03Icon, Tag01Icon, ArrowLeft01Icon, ArrowRight01Icon, ArrowTurnBackwardIcon, ArrowUp02Icon, AtIcon, Award01Icon,
  Bookmark02Icon, Calendar03Icon, Cancel01Icon, ClapperboardIcon, Clock01Icon, Comment01Icon, Door01Icon,
  FavouriteIcon, FilterHorizontalIcon, Film02Icon, Flag02Icon, Globe02Icon, InstagramIcon, Layers01Icon,
  LinkSquare02Icon, Login03Icon, Logout03Icon, Mail01Icon, Moon02Icon, MoreHorizontalIcon, Notification03Icon,
  PencilEdit02Icon, PinIcon, PlayIcon, Search01Icon, Settings02Icon, Share08Icon, ShuffleIcon, SparklesIcon,
  SquareLock02Icon, ThreadsIcon, Tick02Icon, TranslateIcon, UserAdd01Icon, UserGroupIcon, UserIcon, ViewIcon,
  UserCircleIcon, MoreHorizontalCircle01Icon,
} from "@hugeicons/core-free-icons";

type IconData = readonly (readonly [string, Record<string, string | number>])[];

const ICONS = {
  film: Film02Icon,
  clapper: ClapperboardIcon,
  stack: Layers01Icon,
  user: UserIcon,
  users: UserGroupIcon,
  userPlus: UserAdd01Icon,
  bell: Notification03Icon,
  bookmark: Bookmark02Icon,
  gear: Settings02Icon,
  logout: Logout03Icon,
  login: Login03Icon,
  clock: Clock01Icon,
  globe: Globe02Icon,
  language: TranslateIcon,
  calendar: Calendar03Icon,
  laurel: Award01Icon,
  lock: SquareLock02Icon,
  eye: ViewIcon,
  check: Tick02Icon,
  x: Cancel01Icon,
  close: Cancel01Icon,
  comment: Comment01Icon,
  reply: ArrowTurnBackwardIcon,
  at: AtIcon,
  external: LinkSquare02Icon,
  heart: FavouriteIcon,
  search: Search01Icon,
  plus: Add01Icon,
  door: Door01Icon,
  sparkle: SparklesIcon,
  mail: Mail01Icon,
  instagram: InstagramIcon,
  threads: ThreadsIcon,
  arrowLeft: ArrowLeft01Icon,
  arrowRight: ArrowRight01Icon,
  arrowUp: ArrowUp02Icon,
  filter: FilterHorizontalIcon,
  more: MoreHorizontalIcon,
  play: PlayIcon,
  share: Share08Icon,
  pencil: PencilEdit02Icon,
  pin: PinIcon,
  flag: Flag02Icon,
  shuffle: ShuffleIcon,
  moon: Moon02Icon,
  sort: ArrowUpDownIcon,
  dice: DiceFaces03Icon,
  tag: Tag01Icon,
  userCircle: UserCircleIcon,
  moreCircle: MoreHorizontalCircle01Icon,
} as const;

export type IconName = keyof typeof ICONS;

/** Draw a Hugeicons icon's shapes, in the current text colour. */
export function IconShapes({ name }: { name: IconName }) {
  return (
    <>
      {(ICONS[name] as unknown as IconData).map(([tag, attrs], i) => {
        const rest: Record<string, string | number> = { ...attrs };
        delete rest.key;
        const Tag = tag as "path";
        return <Tag key={i} {...rest} />;
      })}
    </>
  );
}

export default function Icon({ name, size, label, className }: { name: IconName; size?: number; label?: string; className?: string }) {
  return (
    <svg
      className={`icon${className ? ` ${className}` : ""}`}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      focusable="false"
    >
      <IconShapes name={name} />
    </svg>
  );
}
