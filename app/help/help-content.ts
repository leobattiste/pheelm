/** User-facing help articles. Keep answers aligned with implemented Pheelm workflows. */
export type HelpQuestion = { id: string; question: string; answer: string; href: string; linkLabel: string };
export type HelpCategory = { id: string; title: string; questions: HelpQuestion[] };
export const HELP_CATEGORIES: HelpCategory[] = [
  {
    "id": "getting-started",
    "title": "Getting started",
    "questions": [
      {
        "id": "getting-started-1",
        "question": "What is Pheelm?",
        "answer": "Pheelm helps you discover films directed or co-directed by Black filmmakers from around the world. Browse films, learn about directors and explore watchlists created by the community.",
        "href": "/about",
        "linkLabel": "About Pheelm"
      },
      {
        "id": "getting-started-3",
        "question": "Is Pheelm free?",
        "answer": "Yes. Exploring Pheelm is free. You can browse films, directors and public watchlists without an account.",
        "href": "/about",
        "linkLabel": "About Pheelm"
      },
      {
        "id": "getting-started-4",
        "question": "Do I need an account to use Pheelm?",
        "answer": "No. You can browse films, directors and public watchlists without signing in. Create an account to save films, follow directors and watchlists, make your own watchlists and join conversations.",
        "href": "/login",
        "linkLabel": "Sign in or create an account"
      },
      {
        "id": "getting-started-5",
        "question": "How do I get started?",
        "answer": "Start with Films or Directors, then explore watchlists made by the community. When you're ready to save films or create a watchlist, sign in or create an account.",
        "href": "/films",
        "linkLabel": "Browse films"
      },
      {
        "id": "getting-started-7",
        "question": "Is the film directory complete?",
        "answer": "No. Pheelm is a curated, growing collection. If a film by a Black director is missing, you can suggest it for review.",
        "href": "/submit",
        "linkLabel": "Suggest a missing film"
      },
      {
        "id": "getting-started-9",
        "question": "Where does Pheelm get its film information?",
        "answer": "Some film details and artwork come from TMDB, and viewing availability may be provided through TMDB and JustWatch. Pheelm also curates its catalog, so information may be incomplete or change over time.",
        "href": "/about",
        "linkLabel": "About Pheelm"
      },
      {
        "id": "getting-started-10",
        "question": "How do I install Pheelm on my phone?",
        "answer": "If your browser offers Add to Home Screen or Install App, select it to add Pheelm to your device. The steps depend on your browser.",
        "href": "/",
        "linkLabel": "Go to Pheelm"
      }
    ]
  },
  {
    "id": "exploring-films",
    "title": "Films",
    "questions": [
      {
        "id": "exploring-films-1",
        "question": "How do I find films?",
        "answer": "Open Films to browse the collection. Use search to look up a title or other term, then open a result to learn more.",
        "href": "/films",
        "linkLabel": "Browse films"
      },
      {
        "id": "exploring-films-3",
        "question": "How do I filter and sort films?",
        "answer": "Open Films and select Filters to narrow results by film type, country, genre or decade. Use Sort to change the order of the films.",
        "href": "/films",
        "linkLabel": "Browse films"
      },
      {
        "id": "exploring-films-9",
        "question": "What can I see on a film page?",
        "answer": "A film page may show its synopsis, poster, director, release information, credits and available trailers or viewing links. You can also save the film to your Watchlist.",
        "href": "/films",
        "linkLabel": "Browse films"
      },
      {
        "id": "exploring-films-11",
        "question": "Where can I watch a film?",
        "answer": "Open a film page and check its available viewing links. Watching, renting or buying happens through the linked provider, and options can differ by country.",
        "href": "/films",
        "linkLabel": "Browse films"
      },
      {
        "id": "exploring-films-12",
        "question": "Why is there no trailer or streaming link?",
        "answer": "Not every film has an available trailer or up-to-date viewing link. That doesn't necessarily mean it cannot be watched elsewhere.",
        "href": "/films",
        "linkLabel": "Browse films"
      },
      {
        "id": "exploring-films-17",
        "question": "Why are some film details missing?",
        "answer": "Some films have limited or conflicting source information. Pheelm updates records when reliable details become available. You can report an error through Feedback.",
        "href": "/feedback?topic=correction",
        "linkLabel": "Report missing film details"
      },
      {
        "id": "films-curation",
        "question": "How does Pheelm choose which films to feature?",
        "answer": "Pheelm focuses on films directed or co-directed by Black filmmakers, including international features, shorts, documentaries and animation. The collection is curated and grows as films can be researched and verified.",
        "href": "/about",
        "linkLabel": "About Pheelm"
      }
    ]
  },
  {
    "id": "directors-and-community",
    "title": "Directors",
    "questions": [
      {
        "id": "directors-and-community-1",
        "question": "How do I find a director?",
        "answer": "Open Directors to browse filmmakers or search by name. Select a director to view their profile.",
        "href": "/directors",
        "linkLabel": "Explore directors"
      },
      {
        "id": "directors-and-community-2",
        "question": "What can I find on a director's profile?",
        "answer": "A director's profile may include a biography, background information and films in Pheelm's collection. Select a film to open its page.",
        "href": "/directors",
        "linkLabel": "Explore directors"
      },
      {
        "id": "directors-and-community-3",
        "question": "How do I follow a director?",
        "answer": "Open a director's profile and select Follow. You'll need to be signed in.",
        "href": "/directors",
        "linkLabel": "Explore directors"
      },
      {
        "id": "directors-and-community-4",
        "question": "Where can I find directors I follow?",
        "answer": "Open your Watchlists page and select Following. Your followed directors appear there.",
        "href": "/me",
        "linkLabel": "Open your watchlists"
      },
      {
        "id": "directors-suggest",
        "question": "Can I suggest a director?",
        "answer": "Yes. Use Contact to tell us which director you'd like to see featured and, if possible, include examples of their films.",
        "href": "/contact",
        "linkLabel": "Suggest a director"
      },
      {
        "id": "directors-missing",
        "question": "Why can't I find a particular director?",
        "answer": "Pheelm's director collection is not complete. A filmmaker may not have been added yet, or we may still be verifying their work. You can suggest someone through Contact.",
        "href": "/contact",
        "linkLabel": "Suggest a director"
      }
    ]
  },
  {
    "id": "watchlist-and-watched",
    "title": "Your Watchlist",
    "questions": [
      {
        "id": "watchlist-and-watched-1",
        "question": "How do I save a film to my Watchlist?",
        "answer": "Sign in, open a film and select Watchlist. You can save the film for later and add it to one of your own watchlists.",
        "href": "/films",
        "linkLabel": "Browse films"
      },
      {
        "id": "watchlist-and-watched-2",
        "question": "Where are my saved films?",
        "answer": "Open Watchlists from the menu, then select All saved films under By you.",
        "href": "/me",
        "linkLabel": "Open your watchlists"
      },
      {
        "id": "watchlist-and-watched-3",
        "question": "How do I remove a film from my Watchlist?",
        "answer": "Open the film and use its Watchlist control to remove it from your saved films.",
        "href": "/films",
        "linkLabel": "Browse films"
      },
      {
        "id": "watchlist-and-watched-4",
        "question": "What's the difference between my Watchlist and a watchlist I create?",
        "answer": "Your Watchlist keeps track of the films you save. You can also create separate watchlists to organize films by themes, filmmakers or other ideas.",
        "href": "/me",
        "linkLabel": "Open your watchlists"
      },
      {
        "id": "watchlist-and-watched-5",
        "question": "How do I mark or unmark a film as watched?",
        "answer": "Open a film's actions and select Watched to mark it as seen. Use the same control again to change the status.",
        "href": "/films",
        "linkLabel": "Browse films"
      },
      {
        "id": "watchlist-and-watched-7",
        "question": "Can others see the films I've watched?",
        "answer": "Watched films may appear on your profile. Open Settings → Privacy to change their visibility.",
        "href": "/account#privacy",
        "linkLabel": "Manage watched-film privacy"
      }
    ]
  },
  {
    "id": "collections",
    "title": "Watchlists & community",
    "questions": [
      {
        "id": "collections-1",
        "question": "What are watchlists?",
        "answer": "Watchlists are themed collections of films created by Pheelm or community members. You can explore public lists and make your own.",
        "href": "/watchlists",
        "linkLabel": "Browse watchlists"
      },
      {
        "id": "collections-2",
        "question": "How do I browse featured or followed watchlists?",
        "answer": "Open Watchlists to browse public lists. Use the available All, Featured and Following views, or Sort, to find what interests you.",
        "href": "/watchlists",
        "linkLabel": "Browse watchlists"
      },
      {
        "id": "collections-4",
        "question": "How do I create a watchlist?",
        "answer": "Sign in and open Watchlists → By you, then choose New watchlist and enter a name. You can also create one while saving a film. Add a description or change its visibility from Edit.",
        "href": "/me",
        "linkLabel": "Create a watchlist"
      },
      {
        "id": "collections-5",
        "question": "How do I add films to a watchlist?",
        "answer": "On a film page, select Watchlist and choose one of your lists. You may also use add-film controls in a watchlist you can edit.",
        "href": "/films",
        "linkLabel": "Browse films"
      },
      {
        "id": "collections-6",
        "question": "How do I edit a watchlist?",
        "answer": "Open a watchlist you own and choose Edit. You can update its title, description, visibility and comment settings.",
        "href": "/me",
        "linkLabel": "Manage your watchlists"
      },
      {
        "id": "collections-8",
        "question": "How do I make a watchlist private?",
        "answer": "Open the watchlist, choose Edit and turn off Public. Private lists can still be available to invited co-curators.",
        "href": "/me",
        "linkLabel": "Open your watchlists"
      },
      {
        "id": "collections-9",
        "question": "Can I turn comments off on a watchlist?",
        "answer": "Open Edit on a watchlist you own and turn off Allow comments. Existing comments may remain visible.",
        "href": "/me",
        "linkLabel": "Open your watchlists"
      },
      {
        "id": "collections-10",
        "question": "How do I delete a watchlist?",
        "answer": "Open your watchlist, select Edit, then Delete watchlist. Confirm the deletion when prompted. This also removes its comments.",
        "href": "/me",
        "linkLabel": "Open your watchlists"
      },
      {
        "id": "collections-11",
        "question": "How do I follow or unfollow a watchlist?",
        "answer": "Open a public watchlist and use the Follow action in its menu. Use the same action to unfollow it. You can see followed watchlists under Watchlists → Following.",
        "href": "/watchlists",
        "linkLabel": "Browse watchlists"
      },
      {
        "id": "collections-13",
        "question": "How do I share a watchlist?",
        "answer": "Open the watchlist and use its Share action, or copy the page's link.",
        "href": "/watchlists",
        "linkLabel": "Browse watchlists"
      },
      {
        "id": "collections-14",
        "question": "How do I collaborate on a watchlist?",
        "answer": "If you're the owner, open your watchlist's collaboration controls to invite or manage co-curators. Invited members get access based on their role.",
        "href": "/me",
        "linkLabel": "Manage shared watchlists"
      },
      {
        "id": "collections-15",
        "question": "What can co-curators change?",
        "answer": "Co-curators can help manage an invited watchlist. Owner-only controls, including deletion and visibility, remain with the owner.",
        "href": "/me",
        "linkLabel": "Manage shared watchlists"
      },
      {
        "id": "collections-16",
        "question": "How do I comment on a watchlist?",
        "answer": "Open a watchlist that allows comments, sign in if needed, and use the comment area.",
        "href": "/watchlists",
        "linkLabel": "Browse watchlists"
      },
      {
        "id": "collections-17",
        "question": "How do I report a watchlist, comment or abusive behavior?",
        "answer": "Use Report on the relevant watchlist or comment when available. Otherwise, send Feedback with a link and a brief description of the issue.",
        "href": "/feedback",
        "linkLabel": "Report a problem"
      },
      {
        "id": "collections-18",
        "question": "Why can’t I see a watchlist?",
        "answer": "It may be private, deleted or unavailable to your account. If you were invited to collaborate, check with the owner.",
        "href": "/watchlists",
        "linkLabel": "Browse watchlists"
      },
      {
        "id": "directors-and-community-5",
        "question": "What are member profiles?",
        "answer": "Member profiles display a member's chosen name or handle and public activity, including eligible watchlists, subject to privacy settings.",
        "href": "/watchlists",
        "linkLabel": "Browse watchlists"
      },
      {
        "id": "directors-and-community-8",
        "question": "How do I interact with other members?",
        "answer": "You can explore other members' public watchlists, follow lists and join conversations where comments are enabled.",
        "href": "/watchlists",
        "linkLabel": "Browse watchlists"
      }
    ]
  },
  {
    "id": "account-and-settings",
    "title": "Account & privacy",
    "questions": [
      {
        "id": "account-and-settings-1",
        "question": "How do I sign in?",
        "answer": "Select Sign in and enter your email and password. If available, you can choose to receive a six-digit email code instead.",
        "href": "/login",
        "linkLabel": "Sign in"
      },
      {
        "id": "account-and-settings-2",
        "question": "Do I need a password?",
        "answer": "New accounts create a password and verify their email. If you joined with email codes before passwords were introduced, Pheelm may prompt you to create one.",
        "href": "/login",
        "linkLabel": "Sign in"
      },
      {
        "id": "account-and-settings-3",
        "question": "I did not receive my sign-in email. What should I do?",
        "answer": "Check your spam folder and confirm you're using the correct address. Request a new code if needed. If the problem continues, use Contact and choose Account Support.",
        "href": "/contact?topic=account",
        "linkLabel": "Contact account support"
      },
      {
        "id": "account-and-settings-4",
        "question": "I forgot my password. What do I do?",
        "answer": "On Sign in, choose Forgot password?, enter your email and follow the instructions sent to you. Use the latest code if you receive more than one.",
        "href": "/login",
        "linkLabel": "Reset your password"
      },
      {
        "id": "account-and-settings-5",
        "question": "How do I change my sign-in email?",
        "answer": "Open Settings → Account and find Sign-in email.",
        "href": "/account#account",
        "linkLabel": "Account settings"
      },
      {
        "id": "account-and-settings-6",
        "question": "How do I sign out of Pheelm?",
        "answer": "Open Settings → Account to sign out. If you need to end sessions on other devices, choose Sign out everywhere.",
        "href": "/account#account",
        "linkLabel": "Manage sign-in sessions"
      },
      {
        "id": "account-and-settings-9",
        "question": "Where do I change the display settings?",
        "answer": "Open Settings → Display to change the theme, poster grid or onboarding tour preferences. Some display preferences are saved on your device.",
        "href": "/account#appearance",
        "linkLabel": "Display settings"
      },
      {
        "id": "account-and-settings-10",
        "question": "How do I manage notifications?",
        "answer": "Open Notifications to review activity. In Settings → Notifications, choose which types of in-app and email notifications you want to receive.",
        "href": "/account#notifications",
        "linkLabel": "Notification settings"
      },
      {
        "id": "account-and-settings-12",
        "question": "How do I manage newsletters and Digest emails?",
        "answer": "Subscribe to the public newsletter on the Newsletter page. For account-specific Digest emails, open Settings → Notifications and choose Off, Daily or Weekly. You can also manage other email notifications there.",
        "href": "/account#notifications",
        "linkLabel": "Manage email preferences"
      },
      {
        "id": "account-and-settings-13",
        "question": "How do I make my profile private?",
        "answer": "In Settings → Privacy, turn on the private-profile option to limit what others can see.",
        "href": "/account#privacy",
        "linkLabel": "Privacy settings"
      },
      {
        "id": "account-and-settings-14",
        "question": "How do I hide my watched films or followed directors?",
        "answer": "Open Settings → Privacy and change the visibility controls for Watched and Following.",
        "href": "/account#privacy",
        "linkLabel": "Privacy settings"
      },
      {
        "id": "account-and-settings-15",
        "question": "How do I download my information?",
        "answer": "Open Settings → Your data and choose Download your data to export available account and community information.",
        "href": "/account#data",
        "linkLabel": "Manage your data"
      },
      {
        "id": "account-and-settings-16",
        "question": "How do I delete my account?",
        "answer": "Open Settings → Your data and choose Delete your account. This permanently removes supported account and community data, subject to necessary legal and operational retention.",
        "href": "/account#data",
        "linkLabel": "Delete your account"
      },
      {
        "id": "account-and-settings-17",
        "question": "Does Pheelm sell my personal information?",
        "answer": "No. Pheelm's Privacy Policy explains how data is used and shared with providers that help operate the platform.",
        "href": "/legal#privacy",
        "linkLabel": "Read the Privacy Policy"
      },
      {
        "id": "account-and-settings-18",
        "question": "Who can see my email address?",
        "answer": "Your sign-in email is not displayed publicly on your profile. See the Privacy Policy for how Pheelm and its providers handle it.",
        "href": "/legal#privacy",
        "linkLabel": "Read the Privacy Policy"
      },
      {
        "id": "directors-and-community-6",
        "question": "How do I edit my profile?",
        "answer": "Open Settings → Profile to update your display name, handle, photograph, country and other optional details.",
        "href": "/account#profile",
        "linkLabel": "Edit your profile"
      },
      {
        "id": "directors-and-community-10",
        "question": "How do I block or unblock a member?",
        "answer": "From a member's profile, open the more-actions menu (⋯) and choose Block. To unblock someone, go to Settings → Privacy and find your blocked members.",
        "href": "/account#privacy",
        "linkLabel": "Privacy settings"
      },
      {
        "id": "directors-and-community-11",
        "question": "What happens when I block a member?",
        "answer": "Blocked members cannot comment on your watchlists, collaborate with you or notify you. Their comments also stop appearing to you.",
        "href": "/account#privacy",
        "linkLabel": "Privacy settings"
      }
    ]
  },
  {
    "id": "submissions-and-support",
    "title": "Submissions & corrections",
    "questions": [
      {
        "id": "submissions-and-support-1",
        "question": "How do I suggest a missing film?",
        "answer": "Sign in, open Suggest a film and enter the requested details. Submissions are reviewed before publication.",
        "href": "/submit",
        "linkLabel": "Suggest a film"
      },
      {
        "id": "submissions-and-support-2",
        "question": "Can filmmakers submit their own work?",
        "answer": "Yes. If you made a film or represent its rights holder, sign in and use Submit your film to send information about the work for review.",
        "href": "/submit/your-film",
        "linkLabel": "Submit your film"
      },
      {
        "id": "submissions-and-support-3",
        "question": "Does submitting a film guarantee it will be added?",
        "answer": "No. Pheelm reviews submissions and may decline or request changes to information.",
        "href": "/submit",
        "linkLabel": "Suggest a film"
      },
      {
        "id": "submissions-and-support-4",
        "question": "How do I request a correction to a film or director?",
        "answer": "Open Feedback, choose the correction option and describe what needs to change. Include the film or director's name and supporting details if available.",
        "href": "/feedback?topic=correction",
        "linkLabel": "Report a correction"
      },
      {
        "id": "submissions-and-support-6",
        "question": "How can I contact Pheelm?",
        "answer": "Use Contact for general questions, account support, press, privacy and other inquiries. Select a subject that matches your message. For bugs, film corrections and feature requests, use Feedback.",
        "href": "/contact",
        "linkLabel": "Contact Pheelm"
      },
      {
        "id": "submissions-and-support-9",
        "question": "How can I support Pheelm?",
        "answer": "You can support Pheelm through the Donate page. Contributions help cover the cost of running and improving the independent platform.",
        "href": "/donate",
        "linkLabel": "Support Pheelm"
      },
      {
        "id": "submissions-and-support-10",
        "question": "Where can I find the community rules?",
        "answer": "Open Legal and choose Community Guidelines to read Pheelm's rules for respectful behavior and participation.",
        "href": "/legal#community-guidelines",
        "linkLabel": "Read community rules"
      }
    ]
  },
  {
    "id": "troubleshooting-and-accessibility",
    "title": "Troubleshooting & support",
    "questions": [
      {
        "id": "troubleshooting-and-accessibility-1",
        "question": "What should I do if a page or feature isn't working?",
        "answer": "Check your connection and try loading the page again. If an action fails to save, review any error message and try again. Report ongoing issues through Feedback with the page URL and what happened.",
        "href": "/feedback",
        "linkLabel": "Give feedback"
      },
      {
        "id": "troubleshooting-and-accessibility-2",
        "question": "Why can’t I save a film or follow someone?",
        "answer": "Check that you're signed in. Some actions require an account, and private or restricted content may not be available to everyone. If it still fails, report the issue through Feedback.",
        "href": "/login",
        "linkLabel": "Sign in"
      },
      {
        "id": "troubleshooting-and-accessibility-4",
        "question": "Why does a streaming link no longer work?",
        "answer": "Streaming providers and their catalogues change. If a viewing link is outdated, report it through Feedback.",
        "href": "/feedback?topic=correction",
        "linkLabel": "Report a correction"
      },
      {
        "id": "troubleshooting-and-accessibility-6",
        "question": "Can I use Pheelm with a keyboard?",
        "answer": "You can navigate most controls with Tab and Shift+Tab and activate focused controls with Enter or Space. If you encounter a keyboard accessibility issue, please report it.",
        "href": "/feedback",
        "linkLabel": "Give feedback"
      },
      {
        "id": "troubleshooting-and-accessibility-8",
        "question": "How can I report an accessibility issue?",
        "answer": "Use Feedback and include the affected page, device and assistive technology if relevant. Explain what prevented you from completing the action.",
        "href": "/feedback",
        "linkLabel": "Report an accessibility problem"
      },
      {
        "id": "troubleshooting-and-accessibility-10",
        "question": "How do I report a copyright or other rights concern?",
        "answer": "Read the Copyright Policy for notice requirements, then send the relevant URLs and details to legal@pheelm.com. You can also use the Contact form for other legal concerns.",
        "href": "/legal#copyright",
        "linkLabel": "Read the Copyright Policy"
      },
      {
        "id": "submissions-and-support-8",
        "question": "How do I propose a partnership?",
        "answer": "Use Partnerships to send a proposal for a film screening, editorial collaboration, educational initiative or another project.",
        "href": "/partnerships",
        "linkLabel": "Propose a partnership"
      }
    ]
  }
];
