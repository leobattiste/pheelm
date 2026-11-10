/**
 * Pheelm's icons, from Hugeicons (the free stroke set, 24×24 grid, 1.5 stroke).
 * Decorative by default (hidden from screen readers); pass `label` when the icon is the only
 * thing saying what something is.
 */
import {
  DashboardCircleSettingsIcon, Add01Icon, ArrowUpDownIcon, DiceFaces03Icon, Tag01Icon, ArrowLeft01Icon, ArrowRight01Icon, ArrowTurnBackwardIcon, ArrowUp02Icon, AtIcon, Award01Icon,
  Bookmark02Icon, Calendar03Icon, Cancel01Icon, FlimSlateIcon, Clock01Icon, Comment01Icon, Door01Icon,
  FavouriteIcon, FilterHorizontalIcon, Film02Icon, Flag02Icon, Globe02Icon, InstagramIcon, Layers01Icon,
  LinkSquare02Icon, Login03Icon, Logout03Icon, Mail01Icon, Moon02Icon, MoreHorizontalIcon, Notification03Icon,
  PencilEdit02Icon, PinIcon, PlayIcon, Search01Icon, Settings02Icon, Share08Icon, ShuffleIcon, SparklesIcon,
  SquareLock02Icon, ThreadsIcon, Tick02Icon, TranslateIcon, UserAdd01Icon, UserGroupIcon, UserIcon, ViewIcon,
  UserCircleIcon, MoreHorizontalCircle01Icon, UserGroup02Icon,
} from "@hugeicons/core-free-icons";

import { GalleryHorizontalEndIcon, RectangleVerticalIcon } from "lucide-react";

type IconData = readonly (readonly [string, Record<string, string | number>])[];

const ICONS = {
  dashboardSettings: DashboardCircleSettingsIcon,
  film: Film02Icon,
  clapper: FlimSlateIcon,
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
  users2: UserGroup02Icon,
  moreCircle: MoreHorizontalCircle01Icon,
} as const;

export type IconName = keyof typeof ICONS | "imdb";

/** Draw a Hugeicons icon's shapes, in the current text colour. */
export function IconShapes({ name }: { name: keyof typeof ICONS }) {
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

export default function Icon({ name, size = 24.5, label, className }: { name: IconName; size?: number; label?: string; className?: string }) {
  const Lucide = name === "film" ? RectangleVerticalIcon : name === "stack" ? GalleryHorizontalEndIcon : null;
  if (Lucide) return <Lucide className={`icon${className ? ` ${className}` : ""}`} size={size} strokeWidth={1.5} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label} focusable="false" />;
  if (name === "imdb") return (
    <svg className={`icon platform-logo${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" width={size} height={size} fill="currentColor" stroke="none" aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label} focusable="false">
      <path d="M22.3781 0H1.6218C.7411.0583.0587.7437.0018 1.5953l-.001 20.783c.0585.8761.7125 1.543 1.5559 1.6191A.337.337 0 0 0 1.6016 24h20.7971a.4579.4579 0 0 0 .0437-.002c.8727-.0768 1.5568-.8271 1.5568-1.7085V1.7098c0-.8914-.696-1.6416-1.584-1.7078A.3294.3294 0 0 0 22.3781 0zm0 .496a1.2144 1.2144 0 0 1 1.1252 1.2139v20.5797c0 .6377-.4875 1.1602-1.1045 1.2145H1.6016c-.5967-.0543-1.0645-.5297-1.1053-1.1258V1.6284C.5371 1.0185 1.0184.5364 1.6217.496h20.7564zM4.7954 8.2603v7.3636H2.8899V8.2603h1.9055zm6.5367 0v7.3636H9.6707v-4.9704l-.6711 4.9704H7.813l-.6986-4.8618-.0066 4.8618h-1.668V8.2603h2.468c.0748.4476.1492.9694.2307 1.5734l.2712 1.8713.4407-3.4447h2.4817zm2.9772 1.3289c.0742.0404.122.108.1417.2034.0279.0953.0345.3118.0345.6442v2.8548c0 .4881-.0345.7867-.0955.8954-.0609.1152-.2304.1695-.5018.1695V9.5211c.204 0 .3457.0205.4211.0681zm-.0211 6.0347c.4543 0 .8006-.0265 1.0245-.0742.2304-.0477.4204-.1357.5694-.2648.1556-.1218.2642-.298.3251-.5219.0611-.2238.1021-.6648.1021-1.3224v-2.5832c0-.6986-.0271-1.1668-.0742-1.4039-.041-.237-.1431-.4543-.3126-.6437-.1695-.1973-.4198-.3324-.7456-.421-.3191-.0808-.8542-.1285-1.7694-.1285h-1.4244v7.3636h2.3051zm5.14-1.7827c0 .3523-.0199.5762-.0544.6708-.033.0947-.1894.1424-.3046.1424-.1086 0-.19-.0477-.2238-.1351-.041-.0887-.0609-.2986-.0609-.6238v-1.9469c0-.3324.0199-.5423.0543-.6237.0338-.0808.1086-.122.2171-.122.1153 0 .2709.0412.3114.1425.041.0947.0609.2986.0609.6032v1.8926zm-2.4747-5.5809v7.3636h1.7157l.1152-.4675c.1556.1894.3251.3324.5152.4271.1828.0881.4608.1357.678.1357.3047 0 .5629-.0748.7802-.237.2165-.1562.3589-.3462.4198-.5628.0543-.2173.0887-.543.0887-.9841v-2.0675c0-.4409-.0139-.7324-.0344-.8681-.0199-.1357-.0742-.2781-.1695-.4204-.1021-.1425-.2437-.251-.4272-.3325-.1834-.0742-.3999-.1152-.6576-.1152-.2172 0-.4952.0477-.6846.1285-.1835.0887-.353.2238-.5086.4007V8.2603h-1.8309z" />
    </svg>
  );
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
