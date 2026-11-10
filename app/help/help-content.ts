/** User-facing help articles. Keep answers aligned with implemented Pheelm workflows. */
export type HelpQuestion = { id: string; question: string; answer: string; href: string };
export type HelpCategory = { id: string; title: string; questions: HelpQuestion[] };
export const HELP_CATEGORIES: HelpCategory[] = [
  {
    "id": "getting-started",
    "title": "Getting started",
    "questions": [
      {
        "id": "getting-started-1",
        "question": "What is Pheelm?",
        "answer": "Pheelm is a platform for discovering films directed or co-directed by Black filmmakers from around the world. Explore films, filmmakers, and collections in one place.",
        "href": "/about"
      },
      {
        "id": "getting-started-2",
        "question": "Who is Pheelm for?",
        "answer": "Anyone curious about cinema by Black directors, including film fans, filmmakers, researchers and people looking for something new to watch.",
        "href": "/about"
      },
      {
        "id": "getting-started-3",
        "question": "Is Pheelm free?",
        "answer": "Yes. Pheelm has free accounts and free discovery features. Some features require signing in, especially while the platform is in early access.",
        "href": "/login"
      },
      {
        "id": "getting-started-4",
        "question": "Why do I need an account?",
        "answer": "An account lets you save films, follow directors and collections, create your own collections, comment and suggest films. Some discovery pages may also require an account during early access.",
        "href": "/login"
      },
      {
        "id": "getting-started-5",
        "question": "How do I get started?",
        "answer": "Sign in with your email, explore Films or Directors, save something to your Watchlist, then browse Collections made by the community.",
        "href": "/films"
      },
      {
        "id": "getting-started-6",
        "question": "How do I find my way around Pheelm?",
        "answer": "The main sections are Films, Collections and Directors. Open the menu for Watchlist, Notifications, Settings, About, Help and support links.",
        "href": "/films"
      },
      {
        "id": "getting-started-7",
        "question": "Is the film directory complete?",
        "answer": "No. Pheelm is a curated selection and grows over time. You can suggest an eligible film that is missing.",
        "href": "/submit"
      },
      {
        "id": "getting-started-8",
        "question": "Which films belong on Pheelm?",
        "answer": "Pheelm focuses on films directed or co-directed by Black filmmakers, from any country or era, across features, shorts, documentaries and animation.",
        "href": "/about"
      },
      {
        "id": "getting-started-9",
        "question": "Where does Pheelm get its film information?",
        "answer": "Film details and artwork are sourced in part from TMDB; viewing availability may come from JustWatch through TMDB. The Pheelm team also curates other information. Some entries may be incomplete.",
        "href": "/about"
      },
      {
        "id": "getting-started-10",
        "question": "How do I install Pheelm on my phone?",
        "answer": "If your browser offers Add to Home Screen or Install App, use that option to place a shortcut to Pheelm on your device. Available options depend on your browser.",
        "href": "/"
      }
    ]
  },
  {
    "id": "exploring-films",
    "title": "Exploring films",
    "questions": [
      {
        "id": "exploring-films-1",
        "question": "How do I explore the film directory?",
        "answer": "Open Films to browse the catalogue. Use the available search, filters and sorting controls to narrow your results.",
        "href": "/films"
      },
      {
        "id": "exploring-films-2",
        "question": "How do I search for a film?",
        "answer": "Use Pheelm’s search control and enter a film title or another relevant term. Select a result to open its page.",
        "href": "/films"
      },
      {
        "id": "exploring-films-3",
        "question": "Can I filter films?",
        "answer": "Yes. On Films, use the available filters, including film type, decade, country, language and genre, to focus your search.",
        "href": "/films"
      },
      {
        "id": "exploring-films-4",
        "question": "Can I change the order of films?",
        "answer": "Use the sorting options on the Films page to change how results are ordered.",
        "href": "/films"
      },
      {
        "id": "exploring-films-5",
        "question": "What is a feature film?",
        "answer": "A feature is a longer-form film, usually the main film in a cinema programme. Running times vary by festival and organisation.",
        "href": "/films"
      },
      {
        "id": "exploring-films-6",
        "question": "What is a short film?",
        "answer": "A short is a film with a shorter running time than a feature. Definitions and cutoffs vary.",
        "href": "/films"
      },
      {
        "id": "exploring-films-7",
        "question": "What is a documentary?",
        "answer": "A documentary is a nonfiction film that explores real people, events, ideas or experiences. Documentary techniques and styles vary widely.",
        "href": "/films"
      },
      {
        "id": "exploring-films-8",
        "question": "Does Pheelm include animation?",
        "answer": "Yes. Animated work by eligible directors can appear alongside live-action films.",
        "href": "/films"
      },
      {
        "id": "exploring-films-9",
        "question": "What can I see on a film page?",
        "answer": "Film pages can include the synopsis, poster, director and other credits, release details, a trailer, viewing links and actions such as Watchlist and Share. Availability varies by film.",
        "href": "/films"
      },
      {
        "id": "exploring-films-10",
        "question": "How can I watch a trailer?",
        "answer": "Open a film page and select Trailer when a trailer is available. Playback is provided through an embedded player.",
        "href": "/films"
      },
      {
        "id": "exploring-films-11",
        "question": "Where can I watch a film?",
        "answer": "Check the viewing links on its film page. Availability depends on your region and may change; streaming or rental happens on the linked provider’s site.",
        "href": "/films"
      },
      {
        "id": "exploring-films-12",
        "question": "Why is there no trailer or streaming link?",
        "answer": "Not every film has a trailer or current viewing information in the source data. Missing links do not necessarily mean a film cannot be watched.",
        "href": "/films"
      },
      {
        "id": "exploring-films-13",
        "question": "How do I share a film?",
        "answer": "Open the film and use its Share action to share its page link.",
        "href": "/films"
      },
      {
        "id": "exploring-films-14",
        "question": "How do I see a film’s cast and crew?",
        "answer": "Open the film detail page and look for the credits sections. Some older or lesser-known films may have limited data.",
        "href": "/films"
      },
      {
        "id": "exploring-films-15",
        "question": "How do I explore films from a particular director?",
        "answer": "Open Directors, select a filmmaker, and explore the films listed on their profile.",
        "href": "/directors"
      },
      {
        "id": "exploring-films-16",
        "question": "What if a film’s title, year, poster or credits are wrong?",
        "answer": "Use Give feedback on the film or the corrections form. Include the film and the specific detail that needs checking.",
        "href": "/feedback?topic=correction"
      },
      {
        "id": "exploring-films-17",
        "question": "Why are some film details incomplete?",
        "answer": "Pheelm combines curated records and outside data. Some films have limited source information, and records are updated as details can be verified.",
        "href": "/feedback?topic=correction"
      }
    ]
  },
  {
    "id": "watchlist-and-watched",
    "title": "Watchlist and watched",
    "questions": [
      {
        "id": "watchlist-and-watched-1",
        "question": "How do I add a film to my Watchlist?",
        "answer": "Open a film and select Watchlist or the add-to-watchlist action. Sign in if prompted.",
        "href": "/me"
      },
      {
        "id": "watchlist-and-watched-2",
        "question": "Where do I find my saved films?",
        "answer": "Open Watchlist from the menu, then choose All saved films under By you.",
        "href": "/me"
      },
      {
        "id": "watchlist-and-watched-3",
        "question": "How do I remove a film from my Watchlist?",
        "answer": "Open the saved film and use its Watchlist action to change or remove it from your saved films.",
        "href": "/me"
      },
      {
        "id": "watchlist-and-watched-4",
        "question": "What is the difference between Watchlist and Watched?",
        "answer": "Watchlist stores films you want to keep track of. Watched marks films you have already seen; you can manage that status separately.",
        "href": "/me"
      },
      {
        "id": "watchlist-and-watched-5",
        "question": "How do I mark a film as watched?",
        "answer": "On a film page, open the more-actions menu (⋯) and select the Watched action.",
        "href": "/films"
      },
      {
        "id": "watchlist-and-watched-6",
        "question": "Can I undo Watched?",
        "answer": "Use the Watched action again on the film to update its status.",
        "href": "/films"
      },
      {
        "id": "watchlist-and-watched-7",
        "question": "Can other people see what I have watched?",
        "answer": "Your watched activity may appear on your profile unless you hide it in Settings → Privacy.",
        "href": "/account#privacy"
      },
      {
        "id": "watchlist-and-watched-8",
        "question": "Can I put a film in a collection too?",
        "answer": "Yes. Watchlist and collections serve different purposes. Collection controls let you organise films into themed lists.",
        "href": "/me"
      }
    ]
  },
  {
    "id": "collections",
    "title": "Collections",
    "questions": [
      {
        "id": "collections-1",
        "question": "What are collections?",
        "answer": "Collections are lists of films grouped by a theme, filmmaker, place, movement or any idea. They can be made by Pheelm or community members.",
        "href": "/watchlists"
      },
      {
        "id": "collections-2",
        "question": "How do I browse collections?",
        "answer": "Open Collections. Switch between All, Featured and Following, and use Sort to change the order.",
        "href": "/watchlists"
      },
      {
        "id": "collections-3",
        "question": "What does Featured mean?",
        "answer": "Featured highlights collections selected by Pheelm.",
        "href": "/watchlists?feed=featured"
      },
      {
        "id": "collections-4",
        "question": "How do I create a collection?",
        "answer": "Sign in, open Watchlist, choose By you, enter a name under New collection and select Create.",
        "href": "/me"
      },
      {
        "id": "collections-5",
        "question": "How do I add films to a collection?",
        "answer": "Use the Watchlist or collection controls on a film page, or the available add-film controls within a collection you can edit.",
        "href": "/films"
      },
      {
        "id": "collections-6",
        "question": "How do I edit a collection?",
        "answer": "Open a collection you own and select Edit to change its title, description, visibility or comment settings.",
        "href": "/me"
      },
      {
        "id": "collections-7",
        "question": "Can collections have long descriptions?",
        "answer": "Yes. Collection descriptions can include longer text; additional paragraphs may appear behind Read more.",
        "href": "/me"
      },
      {
        "id": "collections-8",
        "question": "How do I make a collection private?",
        "answer": "Open your collection, select Edit, and turn off Public. Private collections are visible to you and any co-curators.",
        "href": "/me"
      },
      {
        "id": "collections-9",
        "question": "Can I turn comments off on a collection?",
        "answer": "Yes. Open Edit on a collection you own and turn off Allow comments. Existing comments remain visible, but new comments are disabled.",
        "href": "/me"
      },
      {
        "id": "collections-10",
        "question": "How do I delete a collection?",
        "answer": "Open a collection you own, select Edit and then Delete collection. Confirm when prompted. Deletion also removes its comments.",
        "href": "/me"
      },
      {
        "id": "collections-11",
        "question": "How do I follow a collection?",
        "answer": "Open a public collection and choose Follow. You can find followed collections under Watchlist → Following.",
        "href": "/watchlists"
      },
      {
        "id": "collections-12",
        "question": "How do I stop following a collection?",
        "answer": "Open the collection and change its Follow state. It will no longer appear under your followed collections.",
        "href": "/watchlists"
      },
      {
        "id": "collections-13",
        "question": "How do I share a collection?",
        "answer": "Open the collection and use its share action or copy the page URL.",
        "href": "/watchlists"
      },
      {
        "id": "collections-14",
        "question": "How do I collaborate on a collection?",
        "answer": "Where collaboration is enabled, the owner can invite or manage co-curators through the collection’s collaboration controls. Access depends on the invitation and your role.",
        "href": "/me"
      },
      {
        "id": "collections-15",
        "question": "What can co-curators change?",
        "answer": "Co-curators can help maintain an invited collection, but owner-only controls such as its visibility and deletion remain with the owner.",
        "href": "/me"
      },
      {
        "id": "collections-16",
        "question": "How do I comment on a collection?",
        "answer": "Open a collection with comments enabled and use the comment area. You may need to sign in.",
        "href": "/watchlists"
      },
      {
        "id": "collections-17",
        "question": "Can I report a collection or comment?",
        "answer": "Yes. Use its Report action where available, or send feedback with the page URL and details of the issue.",
        "href": "/feedback"
      },
      {
        "id": "collections-18",
        "question": "Why can’t I see a collection?",
        "answer": "It may be private, deleted, or unavailable to your account. Ask its owner for access if you were invited.",
        "href": "/watchlists"
      }
    ]
  },
  {
    "id": "directors-and-community",
    "title": "Directors and community",
    "questions": [
      {
        "id": "directors-and-community-1",
        "question": "How do I find a director?",
        "answer": "Open Directors and browse or use the available search tools to find a filmmaker.",
        "href": "/directors"
      },
      {
        "id": "directors-and-community-2",
        "question": "What is on a director’s page?",
        "answer": "A director profile may include a biography, filmography and other available background information.",
        "href": "/directors"
      },
      {
        "id": "directors-and-community-3",
        "question": "How do I follow a director?",
        "answer": "Open their director page and select Follow while signed in.",
        "href": "/directors"
      },
      {
        "id": "directors-and-community-4",
        "question": "Where are directors I follow?",
        "answer": "Open Watchlist and choose the Following tab; followed directors appear there.",
        "href": "/me"
      },
      {
        "id": "directors-and-community-5",
        "question": "What are member profiles?",
        "answer": "Member profiles show a person’s chosen name or handle and their public community activity, subject to their privacy settings.",
        "href": "/profile"
      },
      {
        "id": "directors-and-community-6",
        "question": "How do I customise my profile?",
        "answer": "Open Settings → Profile to choose a display name, handle, country or profile photo.",
        "href": "/account#profile"
      },
      {
        "id": "directors-and-community-7",
        "question": "How can people find my profile?",
        "answer": "Your public profile has a link based on your handle. Share that link if you want others to see it.",
        "href": "/profile"
      },
      {
        "id": "directors-and-community-8",
        "question": "How do I interact with other members?",
        "answer": "You can explore members’ public collections, follow collections, and comment when comments are enabled.",
        "href": "/watchlists"
      },
      {
        "id": "directors-and-community-9",
        "question": "How do I report abusive behaviour?",
        "answer": "Use Report on the relevant comment or collection. For other concerns, send feedback with a link and explanation.",
        "href": "/feedback"
      },
      {
        "id": "directors-and-community-10",
        "question": "How do I block someone?",
        "answer": "Open the member’s profile and use its more-actions (⋯) menu to select Block. Manage blocked members in Settings → Privacy.",
        "href": "/account#privacy"
      },
      {
        "id": "directors-and-community-11",
        "question": "What happens if I block someone?",
        "answer": "Blocked members cannot comment on your collections, co-curate with you or notify you; you also stop seeing their comments.",
        "href": "/account#privacy"
      },
      {
        "id": "directors-and-community-12",
        "question": "How do I unblock someone?",
        "answer": "Open Settings → Privacy, find Blocked, and select Unblock beside the member.",
        "href": "/account#privacy"
      }
    ]
  },
  {
    "id": "account-and-settings",
    "title": "Account and settings",
    "questions": [
      {
        "id": "account-and-settings-1",
        "question": "How do I sign in?",
        "answer": "Choose Sign in and enter your email. Pheelm sends a link or code; use it to complete sign-in. You do not need a password.",
        "href": "/login"
      },
      {
        "id": "account-and-settings-2",
        "question": "Do I need to set a password?",
        "answer": "No. Pheelm uses a sign-in link or code sent to your email address.",
        "href": "/login"
      },
      {
        "id": "account-and-settings-3",
        "question": "I did not receive my sign-in email. What should I do?",
        "answer": "Check your spam or junk folder, confirm the email address is correct and try signing in again. If it still fails, contact support.",
        "href": "/contact"
      },
      {
        "id": "account-and-settings-4",
        "question": "My sign-in link expired. What do I do?",
        "answer": "Return to Sign in and request a new email link or code.",
        "href": "/login"
      },
      {
        "id": "account-and-settings-5",
        "question": "How do I change my sign-in email?",
        "answer": "Open Settings → Account, then use the Sign-in email section.",
        "href": "/account#account"
      },
      {
        "id": "account-and-settings-6",
        "question": "How do I sign out?",
        "answer": "Open the menu and select Log out, or use Settings → Account → Sign out.",
        "href": "/account#account"
      },
      {
        "id": "account-and-settings-7",
        "question": "Can I sign out on all devices?",
        "answer": "Yes. Settings → Account provides a Sign out everywhere option.",
        "href": "/account#account"
      },
      {
        "id": "account-and-settings-8",
        "question": "How do I change my profile picture or name?",
        "answer": "Open Settings → Profile and update the relevant profile fields.",
        "href": "/account#profile"
      },
      {
        "id": "account-and-settings-9",
        "question": "Where do I change the appearance?",
        "answer": "Open Settings → Appearance to switch the theme or film-poster grid layout. These preferences are stored on your device.",
        "href": "/account#appearance"
      },
      {
        "id": "account-and-settings-10",
        "question": "Where are my notifications?",
        "answer": "Open Notifications from the menu to see site updates. Use Settings → Notifications to change which types you receive.",
        "href": "/notifications"
      },
      {
        "id": "account-and-settings-11",
        "question": "How do I turn off particular notifications?",
        "answer": "Open Settings → Notifications and change the available preferences.",
        "href": "/account#notifications"
      },
      {
        "id": "account-and-settings-12",
        "question": "How do I subscribe to or unsubscribe from the newsletter?",
        "answer": "Open Settings → Notifications and use the Newsletter control. You can unsubscribe at any time.",
        "href": "/account#notifications"
      },
      {
        "id": "account-and-settings-13",
        "question": "How do I make my profile private?",
        "answer": "Open Settings → Privacy and turn on the private-profile option. Your public visibility is reduced.",
        "href": "/account#privacy"
      },
      {
        "id": "account-and-settings-14",
        "question": "How do I hide my watched films or followed directors?",
        "answer": "Open Settings → Privacy and use the Watched and Following visibility controls.",
        "href": "/account#privacy"
      },
      {
        "id": "account-and-settings-15",
        "question": "How do I download my information?",
        "answer": "Open Settings → Your data and choose Download your data. The export includes supported account and community information.",
        "href": "/account#data"
      },
      {
        "id": "account-and-settings-16",
        "question": "How do I delete my account?",
        "answer": "Open Settings → Your data and select Delete your account. This permanently removes your account and associated data; the action cannot be undone.",
        "href": "/account#data"
      },
      {
        "id": "account-and-settings-17",
        "question": "Does Pheelm sell personal data?",
        "answer": "Pheelm’s privacy policy says personal data is not sold and advertising trackers are not used. Read the full policy for details.",
        "href": "/legal#privacy"
      },
      {
        "id": "account-and-settings-18",
        "question": "Who can see my email address?",
        "answer": "Your email is not shown to other members. The privacy policy explains what the site owner and service providers may access.",
        "href": "/legal#privacy"
      }
    ]
  },
  {
    "id": "submissions-and-support",
    "title": "Submissions and support",
    "questions": [
      {
        "id": "submissions-and-support-1",
        "question": "How do I suggest a missing film?",
        "answer": "Sign in, open Suggest a film, and complete the suggestion form. Pheelm reviews submissions before adding films.",
        "href": "/submit"
      },
      {
        "id": "submissions-and-support-2",
        "question": "Can filmmakers submit their own work?",
        "answer": "Yes. On Suggest a film, choose Submit your own film to open the dedicated filmmaker submission form.",
        "href": "/submit/your-film"
      },
      {
        "id": "submissions-and-support-3",
        "question": "Does submitting a film guarantee it will be added?",
        "answer": "No. Pheelm reviews submissions and decides what belongs in its curated directory.",
        "href": "/submit"
      },
      {
        "id": "submissions-and-support-4",
        "question": "How do I request a correction?",
        "answer": "Use Give feedback on the relevant film page or the feedback form. Describe the correction and include reliable supporting details if available.",
        "href": "/feedback?topic=correction"
      },
      {
        "id": "submissions-and-support-5",
        "question": "How do I suggest a new feature?",
        "answer": "Open Give feedback from the menu or visit the feedback form and describe your idea.",
        "href": "/feedback"
      },
      {
        "id": "submissions-and-support-6",
        "question": "How can I contact Pheelm?",
        "answer": "Use Contact for general questions, press or privacy requests. Use Give feedback for bugs, corrections and feature ideas.",
        "href": "/contact"
      },
      {
        "id": "submissions-and-support-7",
        "question": "How do I report a technical problem?",
        "answer": "Open Give feedback. Include the page where it happened, what you tried, and the error you encountered.",
        "href": "/feedback"
      },
      {
        "id": "submissions-and-support-8",
        "question": "How can organisations partner with Pheelm?",
        "answer": "Open Partnership for enquiries from festivals, film organisations, schools and other potential collaborators.",
        "href": "/partnerships"
      },
      {
        "id": "submissions-and-support-9",
        "question": "Can I support Pheelm financially?",
        "answer": "Yes. Use Donate from the menu for the available support options.",
        "href": "/donate"
      },
      {
        "id": "submissions-and-support-10",
        "question": "Where can I find the community rules?",
        "answer": "Open Legal and choose Community guidelines for the rules on respectful behaviour, submissions and moderation.",
        "href": "/legal#community-guidelines"
      },
      {
        "id": "submissions-and-support-11",
        "question": "Where can I read the privacy policy and terms?",
        "answer": "Open Legal and choose Privacy or Terms. Copyright information is also available there.",
        "href": "/legal"
      }
    ]
  },
  {
    "id": "troubleshooting-and-accessibility",
    "title": "Troubleshooting and accessibility",
    "questions": [
      {
        "id": "troubleshooting-and-accessibility-1",
        "question": "Why won’t a page load?",
        "answer": "Check your connection, reload the page, and try again. If the problem persists, report the page URL through Feedback.",
        "href": "/feedback"
      },
      {
        "id": "troubleshooting-and-accessibility-2",
        "question": "Why can’t I save a film or follow someone?",
        "answer": "Some actions require an account. Make sure you are signed in and try again. Report persistent errors through Feedback.",
        "href": "/login"
      },
      {
        "id": "troubleshooting-and-accessibility-3",
        "question": "Why did my changes not save?",
        "answer": "Check your connection, look for a validation or error message, and retry. For a recurring problem, report the page and action involved.",
        "href": "/feedback"
      },
      {
        "id": "troubleshooting-and-accessibility-4",
        "question": "Why does a streaming link no longer work?",
        "answer": "Streaming providers and film availability change. Try another available provider or report the outdated link.",
        "href": "/feedback?topic=correction"
      },
      {
        "id": "troubleshooting-and-accessibility-5",
        "question": "Why does the site look different on my phone?",
        "answer": "Pheelm adapts its layout to screen size. On smaller screens, use the bottom navigation and More menu to reach additional pages.",
        "href": "/"
      },
      {
        "id": "troubleshooting-and-accessibility-6",
        "question": "Can I use Pheelm with a keyboard?",
        "answer": "Pheelm provides keyboard-accessible navigation controls; use Tab and Shift+Tab to move between controls, Enter or Space to activate buttons, and Escape to close supported dialogs.",
        "href": "/"
      },
      {
        "id": "troubleshooting-and-accessibility-7",
        "question": "Does Pheelm work offline?",
        "answer": "If installed to your home screen, previously opened pages may be cached for offline use. Fresh content and actions such as saving or commenting need a connection.",
        "href": "/"
      },
      {
        "id": "troubleshooting-and-accessibility-8",
        "question": "How can I report an accessibility issue?",
        "answer": "Use Give feedback and describe the affected page, device, assistive technology (if any) and what prevented you from using it.",
        "href": "/feedback"
      },
      {
        "id": "troubleshooting-and-accessibility-9",
        "question": "Why am I not seeing a notification?",
        "answer": "Check your notification preferences in Settings. Notifications depend on the relevant activity and feature being enabled.",
        "href": "/account#notifications"
      },
      {
        "id": "troubleshooting-and-accessibility-10",
        "question": "How do I report copyright or rights concerns?",
        "answer": "Use Contact and include the page URL, the material concerned, your relationship to the rights, and a way to reach you.",
        "href": "/contact"
      }
    ]
  }
];
