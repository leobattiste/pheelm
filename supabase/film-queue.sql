-- The admin's film queue: films waiting to be added from TMDB, kept in the database so it can be
-- added to, run and cleared from Admin > Films > Add films. Only admins can see or change it.
-- Each item can carry the essay that becomes the film's synopsis when it's added. Safe to run twice.
create table if not exists public.film_queue (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 300),
  year integer check (year between 1880 and 2100),
  director_name text check (char_length(director_name) <= 200),
  director_keys text[] not null default '{}',
  synopsis text check (char_length(synopsis) <= 10000),
  last_error text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists film_queue_title_year on public.film_queue (lower(title), coalesce(year, 0));
alter table public.film_queue enable row level security;
drop policy if exists "admins manage the film queue" on public.film_queue;
create policy "admins manage the film queue" on public.film_queue for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.film_queue from anon;
grant select, insert, update, delete on public.film_queue to authenticated;

-- Start with the films picked for Pheelm that aren't in the catalog yet.
insert into public.film_queue (title, year, director_name, director_keys, synopsis)
select v.title, v.year, v.director_name, v.director_keys, v.synopsis
from (values
('Kongi''s Harvest',1970,'Ossie Davis',array['davis']::text[],'Ossie Davis went to Nigeria to film Wole Soyinka''s play, and Soyinka himself plays Kongi, a dictator in an invented African nation who wants the traditional king to hand him the first yam of the harvest festival. The ceremony is a stage on which power performs its own legitimacy, and the film watches that performance with a satirist''s eye.

It arrived barely a decade after independence across much of the continent, when the strongman was becoming a familiar figure. Davis, coming off Cotton Comes to Harlem, took his camera across the Atlantic, a crossing of the diaspora that was rare in cinema at the time.'),
('Five on the Black Hand Side',1973,'Oscar Williams',array['williams']::text[],'A barber who runs his household like a small kingdom finds his wife, his children and his customers quietly organising against him. Adapted by Charlie L. Russell from his own play, Oscar Williams'' comedy turns the politics of its moment, from Black pride to women''s liberation, into a family argument at the dinner table.

Released at the height of the action-driven Black films of the early 1970s, it offered something rarer: a warm, talky picture of Black middle-class life, where the stakes are respect and change inside one home. Its humour is gentle, and its sympathy is with the people who want to be heard.'),
('The Human Tornado',1976,'Cliff Roquemore',array['roquemore']::text[],'Rudy Ray Moore brought back his rhyming, kung-fu-fighting pimp Dolemite for a sequel even wilder than the first: a chase across Alabama and California, a rescue from a mobster, and a series of set pieces that seem built on the logic of a party story told late at night. Cliff Roquemore directs with a cheerful disregard for polish.

That roughness is the point. Moore financed and sold his films outside the studio system, playing to Black audiences who knew his comedy records, and The Human Tornado is a document of that independent circuit. Decades later it was rediscovered as a cult object and a source for hip-hop''s love of brag and verse.'),
('Bustin'' Loose',1981,'Oz Scott',array['scott']::text[],'Richard Pryor plays a small-time crook on parole who is talked into driving a broken-down school bus of troubled children and their teacher, played by Cicely Tyson, from Philadelphia to a farm in Washington State. Pryor developed the story himself, and Oz Scott, a theatre director, guides it on screen.

It''s a road comedy with a soft centre, and its pleasure is watching Pryor''s nervous, profane energy soften around kids who have been failed by every adult before him. Tyson grounds the film, and the film became a box-office success with a Black director and Black leads.'),
('Fast Forward',1985,'Sidney Poitier',array['poitier']::text[],'A group of young dancers from a small town in Ohio come to New York on the promise of an audition that falls through, and decide to make their own break. Sidney Poitier''s last feature as a director is a musical of hope and hustle, built on breakdancing and street choreography at the moment those styles were reaching the mainstream.

It''s slight next to Poitier''s earlier work, but it''s also characteristic of him: optimistic, generous to its young cast, and interested in talent as something earned through discipline. As a snapshot of mid-1980s dance culture, it has a charm that survives.'),
('Eddie Murphy Raw',1987,'Robert Townsend',array['townsend']::text[],'Filmed at New York''s Felt Forum at the height of Eddie Murphy''s fame, Raw captures a comedian in complete command of an arena. Robert Townsend, fresh from Hollywood Shuffle, directs, and the film opens with a sketch of a young Murphy watching his family trade jokes at a Thanksgiving table, a reminder of where the voice comes from.

Raw was for many years the highest-grossing stand-up film ever made. Much of its material about women and gay men has aged badly, and it''s worth watching with that in mind. It remains an important record of how Black stand-up conquered the biggest stages in American entertainment.'),
('Hell-Bound Train',1930,'Eloyce Gist',array['gist']::text[],'James and Eloyce Gist, travelling evangelists with no formal film training, made this silent allegory to show at churches and community halls. Passengers board a train driven by the devil, and each car holds a different temptation of modern life, from jazz and dancing to drinking and gambling.

Shot on handheld 16mm, it''s raw and inventive, closer to folk art than to Hollywood. It''s also one of the very few surviving films made by Black women before sound became standard. The Library of Congress preserved it, and in 2021 it was added to the National Film Registry.'),
('Birthright',1938,'Oscar Micheaux',array['micheaux']::text[],'Oscar Micheaux remade his own 1924 silent film as a talkie: a young Black man graduates from Harvard and returns to his Tennessee hometown hoping to open a school on the model of Tuskegee, only to meet resistance from white townspeople and suspicion from his own community.

Based on a novel by T. S. Stribling, the story let Micheaux return to his recurring subjects: education, respectability and the price of ambition in the segregated South. The 1924 version is lost, and only part of this one survives, restored under the supervision of the Library of Congress.'),
('Selma, Lord, Selma',1999,'Charles Burnett',array['burnett']::text[],'Charles Burnett tells the story of the 1965 Selma voting rights campaign through two young girls, based on the memoir by Sheyann Webb and Rachel West Nelson, who were children when they marched. The film follows them from Dr. King''s arrival in town to the violence of Bloody Sunday on the Edmund Pettus Bridge.

Made for Disney''s television audience, it carries Burnett''s eye for daily life: kitchens, churches and schoolrooms where history is lived before it''s written down. It''s one of the clearest introductions to the movement for younger viewers, and it treats children as witnesses with their own courage.'),
('Jason''s Lyric',1994,'Doug McHenry',array['mchenry']::text[],'In Houston''s Fifth Ward, a young man tries to build a future with the woman he loves while his brother pulls the family toward violence, and memories of their troubled father, a Vietnam veteran played by Forest Whitaker, shadow them both. Allen Payne and Jada Pinkett lead, with Bokeem Woodbine as the brother.

Doug McHenry shoots the story as a romance first, with a lushness unusual for the urban dramas of its time. It''s a film about trauma passing between generations, and about the dream of leaving, told with tenderness and a willingness to be emotional.'),
('Drop Squad',1994,'David C. Johnson',array['johnson']::text[],'An advertising executive who has made a career selling degrading campaigns to Black consumers is kidnapped by an underground group that ''deprograms'' people they see as having sold out their community. Eriq La Salle plays the target, and Ving Rhames is one of his captors.

David C. Johnson expanded his own short film into a feature, with Spike Lee as executive producer. Part satire and part interrogation drama, it asks uncomfortable questions about success, assimilation and who gets to judge them, and it doesn''t let its vigilantes off easily either.'),
('She Hate Me',2004,'Spike Lee',array['lee']::text[],'A pharmaceutical executive who blows the whistle on fraud is fired, frozen out and broke, and he starts earning money by fathering children for lesbian women who want them. Anthony Mackie leads a sprawling cast in one of Spike Lee''s most provocative films.

The film ties corporate corruption to Watergate and to the history of who gets believed when they speak up. Its sexual politics drew heavy criticism, and it remains divisive. It''s also Lee at his most unruly and ambitious, trying to say something about money, power and the body all at once.'),
('A Huey P. Newton Story',2001,'Spike Lee',array['lee']::text[],'Roger Guenveur Smith performs his one-man show about the co-founder of the Black Panther Party, and Spike Lee films it with an intimacy that puts the audience in the same smoky room. Smith''s Newton is restless, funny, paranoid and brilliant, circling his own legend late in life.

Rather than a biography, it''s a portrait of a mind under pressure, built from Newton''s words and Smith''s long study of him. It''s a reminder that the Panthers were led by people, with contradictions, and not just by the images on posters.'),
('Passing Strange',2009,'Spike Lee',array['lee']::text[],'Spike Lee filmed the final Broadway performances of Stew''s rock musical, in which a young Black man leaves middle-class Los Angeles for Amsterdam and Berlin in search of something he calls ''the real''. Stew narrates his younger self''s journey from the side of the stage with his band.

The show won the Tony Award for best book of a musical, and Lee''s film keeps its energy and its humour. It''s a story about art, authenticity and the parts of home you can''t escape, and it captures a piece of theatre that might otherwise have been lost.'),
('Red Hook Summer',2012,'Spike Lee',array['lee']::text[],'A boy from Atlanta is sent to spend the summer with his grandfather, a fiery preacher in Brooklyn''s Red Hook projects. Clarke Peters plays the bishop, and the film moves through sermons, heat and a neighbourhood changing around its residents.

Spike Lee calls it a chapter of his ''Chronicles of Brooklyn'', and Mookie from Do the Right Thing makes a brief return. Made on a small budget, it takes a turn in its last act that many viewers found shocking, and it''s one of Lee''s most personal looks at faith and what churches hide.'),
('Da Sweet Blood of Jesus',2014,'Spike Lee',array['lee']::text[],'Spike Lee funded this film through Kickstarter and made it as a reworking of Bill Gunn''s 1973 cult classic Ganja & Hess. An anthropologist is stabbed with an ancient African dagger and wakes with a thirst for blood, which draws him and the woman he loves into an addiction they can''t quit.

Like Gunn''s original, it uses the vampire story to talk about desire, faith and assimilation among the Black elite. It''s an act of homage to one of the great overlooked American films, and a way of pointing new audiences toward it.'),
('American Utopia',2020,'Spike Lee',array['lee']::text[],'Spike Lee films David Byrne''s Broadway concert, in which Byrne and eleven barefoot musicians move across a bare stage with wireless instruments. The songs span Talking Heads and Byrne''s solo career, linked by reflections on democracy, connection and how to live with each other.

Lee''s camera finds unexpected angles, including overhead shots that turn the choreography into patterns. In its most powerful moment, the band performs Janelle Monáe''s ''Hell You Talmbout'' as faces of Black Americans killed by police fill the screen. It''s a joyous film with that grief at its heart.'),
('Night Catches Us',2010,'Tanya Hamilton',array['hamilton']::text[],'In 1976, a former Black Panther returns to his Philadelphia neighbourhood for his father''s funeral and finds old suspicions waiting: many believe he betrayed a comrade years before. Anthony Mackie and Kerry Washington lead, with a score by The Roots.

Tanya Hamilton''s first feature is quiet and deeply felt, more interested in what the movement cost its members than in its slogans. It''s one of the few films to imagine the years after the Panthers, when people had to live with what happened and raise children in its wake.'),
('Mississippi Damned',2009,'Tina Mabry',array['mabry']::text[],'Tina Mabry''s first feature follows three children growing up in rural Mississippi in the 1980s and 1990s, and the cycles of poverty, abuse and addiction that close in around their family. The story draws on Mabry''s own life.

It''s an unflinching film, but it''s not hopeless: its subject is the cost of escape, and who manages it. It won awards on the festival circuit and has gathered a reputation since as a key work of Black Southern independent cinema.'),
('The Supremes at Earl''s All-You-Can-Eat',2024,'Tina Mabry',array['mabry']::text[],'Three friends who have met at the same Indiana diner since the 1960s face illness, marriage and grief as they reach middle age. Aunjanue Ellis-Taylor, Uzo Aduba and Sanaa Lathan play the women, and the film moves between their present and their younger selves.

Adapted from Edward Kelsey Moore''s novel, Tina Mabry''s film is a celebration of long friendship among Black women, the kind that outlasts husbands and holds through hard news. It''s a warm, generous film about the people who know your whole story.'),
('See You Yesterday',2019,'Stefon Bristol',array['bristol']::text[],'Two teenage science prodigies in Brooklyn build a time machine for a school project, then try to use it to save one of their brothers from being killed by the police. Stefon Bristol expanded his own short into this feature, produced by Spike Lee.

It''s a lively, inventive science-fiction film that uses the genre''s rules to ask a painful question: what if you could change a single moment? The answer it gives is sobering, and the film''s young cast carries it with real charm.'),
('Luce',2019,'Julius Onah',array['onah']::text[],'A star high-school athlete and debater, adopted as a child from war-torn Eritrea, comes under suspicion when a teacher finds something troubling in one of his essays. Kelvin Harrison Jr. plays Luce, with Octavia Spencer as the teacher and Naomi Watts and Tim Roth as his adoptive parents.

Julius Onah''s film, adapted from J. C. Lee''s play, refuses to settle on who is right. It''s a sharp study of the expectations placed on young Black men to be perfect, and of how quickly suspicion forms around them.'),
('Native Son',2019,'Rashid Johnson',array['johnson']::text[],'Artist Rashid Johnson''s first film updates Richard Wright''s 1940 novel to present-day Chicago. Ashton Sanders plays Bigger Thomas, a young man with green hair and punk records who takes a job as a driver for a wealthy family, with tragic consequences. Suzan-Lori Parks wrote the screenplay.

The adaptation keeps the novel''s anger but changes its hero, making him more inward and searching. It''s a film about the narrow choices offered to young Black men, and about how quickly one mistake becomes a sentence.'),
('Premature',2019,'Rashaad Ernesto Green',array['green']::text[],'In the summer before she leaves Harlem for college, a 17-year-old poet falls for an older music producer, and the romance becomes something she must learn to survive. Zora Howard co-wrote the script with director Rashaad Ernesto Green and plays the lead.

It''s an intimate coming-of-age story, shot on the streets and rooftops of Harlem, about first love and losing yourself in it. Howard''s performance and her poetry give the film its voice.'),
('Emergency',2022,'Carey Williams',array['williams']::text[],'Two Black college seniors set out on a legendary night of parties and come home to find an unconscious white girl on their floor. Afraid of what will happen if they call the police, they try to sort it out themselves. Carey Williams expanded his short into this feature, which premiered at Sundance.

It starts as a comedy and darkens as it goes, using the conventions of a night-out movie to show how fear of the police shapes every decision. It''s funny, tense and pointed about what young Black men have to calculate.'),
('Devotion',2022,'J.D. Dillard',array['dillard']::text[],'The true story of Jesse Brown, the first Black aviator to complete the U.S. Navy''s basic flight training, and his friendship with a white wingman during the Korean War. Jonathan Majors plays Brown and Glen Powell plays Tom Hudner.

J. D. Dillard films the flying with real scale, but the film is most interested in Brown''s private life: the insults he rehearses in a mirror to harden himself, and the family he flies for. It''s a war film about dignity under pressure.'),
('Chevalier',2022,'Stephen Williams',array['williams']::text[],'Joseph Bologne, the Chevalier de Saint-Georges, was a celebrated violinist, composer and fencer in 18th-century France, the son of an enslaved African woman and a French planter. Kelvin Harrison Jr. plays him rising to the court of Marie Antoinette, then falling foul of it.

Stephen Williams'' film is a vivid, sometimes fanciful period drama, but it puts back into history a figure who was nearly erased. It''s a story about genius allowed only so far, and about choosing between belonging and freedom.'),
('Shirley',2024,'John Ridley',array['ridley']::text[],'In 1972, Shirley Chisholm became the first Black candidate to seek a major party''s nomination for president. Regina King plays her through that campaign, with its tiny budget, fractious advisers and the open hostility of the political establishment.

John Ridley''s film is a portrait of someone who ran knowing she would lose, to prove that she could run at all. It''s about principle and compromise, and about a woman whose famous slogan, ''Unbought and Unbossed'', became a lasting statement of independence.'),
('Albany Road',2024,'Christine Swanson',array['swanson']::text[],'A busy executive, played by Renée Elise Goldsberry, finds herself sharing a long road trip with a woman connected to her past, played by Lynn Whitfield. What begins as an inconvenience turns into a reckoning with grief, family and the plans we make for our lives.

Christine Swanson''s film is a character piece driven by two strong performances. It belongs to a small but welcome tradition of road movies centred on Black women, where the journey is mostly about what they finally say to each other.'),
('Little',2019,'Tina Gordon',array['gordon']::text[],'A tyrannical tech boss is magically turned back into her 13-year-old self and has to return to middle school while her overworked assistant keeps the company running. Regina Hall plays the adult, Marsai Martin plays the child and Issa Rae plays the assistant.

Marsai Martin came up with the idea and became the youngest executive producer in Hollywood history when the film was made. Tina Gordon''s comedy is a body-swap story with a point about how childhood wounds shape adult power, and it gave three Black women the lead in a studio comedy.'),
('Dutchman',2025,'Andre Gaines',array['gaines']::text[],'Amiri Baraka''s 1964 play, in which a white woman and a Black man meet on a New York subway car with deadly results, is one of the most charged works of American theatre. Andre Gaines'' film reimagines it for the present, with André Holland and Kate Mara in the central roles and Zazie Beetz alongside them.

The play has been read for sixty years as a parable about desire, rage and the masks Black Americans are made to wear. This adaptation brings that confrontation into a new century, asking what has and hasn''t changed.'),
('Still a Brother: Inside the Negro Middle Class',1968,'William Greaves',array['greaves']::text[],'Made for National Educational Television, William Greaves'' documentary, written by William Branch and narrated by Ossie Davis, interviews Black professionals across America about money, status and what success had and hadn''t bought them. It moves from suburban homes to the rising energy of Black nationalism.

At a moment when television mostly showed Black Americans in crisis, the film looked at a middle class caught between integration and a new pride. It was nominated for an Emmy, and its central question, whether economic gains could ever mean equality, has not gone away.'),
('From These Roots',1974,'William Greaves',array['greaves']::text[],'William Greaves tells the story of the Harlem Renaissance almost entirely through still photographs, music and the words of the period. The poets, painters, musicians and political thinkers of 1920s Harlem appear in images, held long enough for a viewer to look closely.

It''s a model of how to make history vivid without reenactment. Greaves treats the Renaissance as a movement of ideas as well as art, and the film became a classroom staple and one of his most honoured works.'),
('Imperfect Journey',1994,'Haile Gerima',array['gerima']::text[],'Haile Gerima returns to Ethiopia after the fall of the Derg military regime, travelling with the Polish journalist Ryszard Kapuściński, who had written about the last days of Haile Selassie. Together they meet ordinary Ethiopians trying to make sense of years of terror and an uncertain new government.

Commissioned by the BBC, it''s a personal and political film: Gerima is filming his own country, and his questions are sharp and unsentimental. It sits beside his features as a document of a nation working out how to remember.'),
('This Is the Life',2008,'Ava DuVernay',array['duvernay']::text[],'Ava DuVernay''s first feature-length film documents the Good Life Café, a health-food shop in South Central Los Angeles whose Thursday open-mic nights became a proving ground for alternative hip-hop from the late 1980s. Artists including Freestyle Fellowship and members of Jurassic 5 came up there.

DuVernay was part of that scene herself, and the film is affectionate and well informed. It''s a history of a West Coast movement that valued lyricism and community over sales, told by the people who built it.'),
('Tell Them We Are Rising: The Story of Black Colleges and Universities',2017,'Stanley Nelson',array['nelson']::text[],'Stanley Nelson traces the history of historically Black colleges and universities from schools founded in secret during slavery to their role in the civil rights movement and beyond. Archival material and interviews show how these institutions shaped Black leadership in nearly every field.

It''s a sweeping, clear history and a tribute to the teachers and students who built higher education for people shut out of it. Made for public television, it''s essential viewing for anyone curious about how Black America educated itself.'),
('Boss: The Black Experience in Business',2019,'Stanley Nelson',array['nelson']::text[],'Stanley Nelson tells the history of Black entrepreneurship in America, from people who bought their way out of slavery to beauty empires, insurance companies and the modern founders who still face closed doors to capital. Figures such as Madam C. J. Walker appear alongside lesser-known business people.

The film is clear about how violence, segregation and lending discrimination repeatedly destroyed Black wealth, and it''s equally clear about the ingenuity that rebuilt it. It''s a history lesson in economic terms, often missing from the classroom.'),
('Crack: Cocaine, Corruption & Conspiracy',2021,'Stanley Nelson',array['nelson']::text[],'Stanley Nelson examines the crack epidemic of the 1980s: how the drug spread through American cities, the role of the CIA-linked cocaine trade, and the political response that treated users as criminals rather than patients. Former dealers, users and journalists tell the story.

It''s an angry, carefully argued film about how an epidemic was framed by race, and how that framing shaped laws and prisons for decades. It''s also a reminder of how differently later drug crises have been treated.'),
('Twelve Disciples of Nelson Mandela',2005,'Thomas Allen Harris',array['harris']::text[],'In 1960, twelve young men from Bloemfontein left South Africa to build support abroad for the African National Congress, living in exile for decades. One of them was the stepfather of director Thomas Allen Harris, who tells their story through his own family''s.

It''s a personal documentary about the cost of political commitment: the years away, the families raised in other countries, and the homecomings after apartheid fell. It honours the people who did the unglamorous work behind a famous movement.'),
('Ailey',2021,'Jamila Wignot',array['wignot']::text[],'Jamila Wignot''s portrait of Alvin Ailey follows the choreographer from his Texas childhood to the founding of the dance company that made Revelations one of the most loved works of American dance. Archival footage and Ailey''s own recorded words are woven with the company creating a new piece in his honour.

The film doesn''t hide Ailey''s loneliness or the pressures he lived under as a gay Black man who died of AIDS-related illness in 1989. It''s a moving account of an artist who put Black life and faith on the concert stage.'),
('Black Ice',2022,'Hubert Davis',array['davis']::text[],'Hubert Davis traces the history of Black hockey players, beginning with the Colored Hockey League of the Maritimes, founded in Canada in the 1890s, and following the racism players still meet on the ice and in the stands today. Current and former players speak openly about what the sport has asked of them.

The film won the People''s Choice Documentary Award at the Toronto International Film Festival. It recovers a history that hockey itself had almost forgotten, and it makes the case that the game''s future depends on facing it.'),
('John Lewis: Good Trouble',2020,'Dawn Porter',array['porter']::text[],'Dawn Porter''s portrait of the civil rights leader and longtime Georgia congressman follows John Lewis from the Freedom Rides and the march at Selma to his last years in Congress, fighting for voting rights. Lewis tells much of the story himself.

The film was released in July 2020, weeks before Lewis died, and it became a farewell. It''s a straightforward, affectionate biography of a man whose phrase ''good trouble'' came to stand for a whole philosophy of protest.'),
('Gideon''s Army',2013,'Dawn Porter',array['porter']::text[],'Dawn Porter follows three young public defenders in the American South, carrying huge caseloads for clients who can''t afford lawyers. The title refers to the 1963 Supreme Court decision that guaranteed legal counsel to people charged with crimes.

It''s a film about the gap between a constitutional right and the reality of an underfunded system, seen through people who keep showing up anyway. It won an editing award at Sundance and is a vivid picture of how justice works when no one is watching.'),
('Trapped',2016,'Dawn Porter',array['porter']::text[],'Dawn Porter documents the clinics and doctors in the American South fighting state laws designed to close abortion providers by imposing strict building and staffing rules. The film follows their legal battle as it heads to the Supreme Court.

It won a special jury award for social impact at Sundance. Seen after the end of Roe v. Wade, it reads as an account of how access was being taken away long before that ruling, one regulation at a time.'),
('Quincy',2018,'Rashida Jones',array['jones','hicks']::text[],'Directed by Rashida Jones, Quincy Jones'' daughter, with Alan Hicks, this documentary follows the producer and composer across a career that ran from big-band jazz to film scores to Michael Jackson''s Thriller. It mixes decades of archive with intimate footage of Jones in his eighties.

It''s a family portrait as much as a career survey, frank about the cost of his work on his health and relationships. It won the Grammy Award for best music film.'),
('Little Richard: I Am Everything',2023,'Lisa Cortés',array['cortés']::text[],'Lisa Cortés'' documentary argues for Little Richard as one of the true architects of rock and roll, a Black queer performer whose style was borrowed by white stars who got more credit and more money. It moves through his music, his conflicts with faith and his complicated feelings about his own sexuality.

It opened the 2023 Sundance Film Festival. The film is celebratory but honest, using the voices of Black queer scholars to place him in a history that had pushed him to its edges.'),
('Unapologetic',2020,'Ashley O''Shay',array['o''shay']::text[],'Ashley O''Shay follows two young Black women organisers in Chicago in the years after the police killings of Rekia Boyd and Laquan McDonald, as they push for accountability and an end to police violence. The film stays close to their work, their friendships and their exhaustion.

It''s a film about leadership that rarely makes the news, the meetings, the public hearings and the care organisers give each other. It centres Black women and queer activists who are often doing the most work and getting the least attention.'),
('Seeds',2025,'Brittany Shyne',array['shyne']::text[],'Brittany Shyne spent years with Black farming families in the American South, filming in black and white as they work land that their families have held for generations, and face the pressures that threaten to take it away. The film is patient and observational, built on the rhythms of seasons and work.

It won the Grand Jury Prize for U.S. documentary at the 2025 Sundance Film Festival. It''s a film about inheritance, in every sense, and about the quiet persistence of people holding on to land that history tried to take from them.'),
('John Henrik Clarke: A Great and Mighty Walk',1996,'St. Clair Bourne',array['bourne']::text[],'St. Clair Bourne''s portrait of the historian John Henrik Clarke follows his life from rural Georgia to Harlem, where, largely self-taught, he became one of the leading voices of African and African American history.

Clarke speaks for himself across the film, laying out his conviction that history is a tool for liberation. It''s both a biography and a lesson in his ideas, and a tribute from one pioneer of Black independent documentary to another kind of pioneer.'),
('BaadAsssss Cinema',2002,'Isaac Julien',array['julien']::text[],'Isaac Julien''s documentary explores the Black action films of the 1970s, from Sweet Sweetback''s Baadasssss Song to Shaft and Coffy, through interviews with the actors and directors who made them and the critics who argued about them, from Pam Grier to bell hooks.

Julien takes the genre seriously without pretending it was simple. The film looks at the pleasure and empowerment these films gave Black audiences alongside their exploitation, and at their long influence on everything from hip-hop to Quentin Tarantino.'),
('Silver Dollar Road',2023,'Raoul Peck',array['peck']::text[],'Raoul Peck follows the Reels family of coastal North Carolina, who have lived on their land for generations and fought developers for years over who owns it. Two brothers spent eight years in jail for refusing to leave. The film grew from reporting by Lizzie Presser for ProPublica.

Peck lets the family tell their story, showing a matriarch who holds everyone together. It''s an intimate account of how Black families across the South lost land through legal loopholes, and what it costs to stand your ground.'),
('Lumumba: Death of a Prophet',1990,'Raoul Peck',array['peck']::text[],'Before making his feature about Patrice Lumumba, Raoul Peck made this documentary about the first prime minister of independent Congo, who was overthrown and murdered in 1961. Peck mixes archive with his own memories of growing up in Congo, where his family lived after leaving Haiti.

It''s an essay on how history is recorded and by whom, asking why the image of an African leader killed with Western complicity was so easily forgotten. It laid the groundwork for Peck''s later work on power and memory.'),
('Ouvrir la voix',2017,'Amandine Gay',array['gay']::text[],'Amandine Gay interviewed two dozen Black women from France and Belgium about their lives: racism at school, in work and in love, the expectations placed on their bodies, and their experiences as women of African and Caribbean descent in Europe.

Made independently over several years, the film gives its subjects space to speak at length and in their own words, without a narrator. It became an important reference point for conversations about race and gender in French-speaking Europe, where such stories are rarely heard on screen.'),
('Nous',2021,'Alice Diop',array['diop']::text[],'Alice Diop travels the length of the RER B commuter line that crosses Paris and its suburbs, filming the people who live along it: a mechanic, a writer, families at a hunting party, and her own family''s story as Senegalese immigrants. The film is inspired by François Maspero''s book about the same journey.

It won best film in the Encounters section of the Berlin Film Festival. Diop builds a portrait of France out of fragments, a country of many lives that rarely meet, and asks what it means to say ''we''.'),
('Marcher sur l''eau',2021,'Aïssa Maïga',array['maïga']::text[],'In a village in northern Niger, a young girl and her family wait for water: the well is far away, the rains are failing, and the men leave in search of work. Actor and director Aïssa Maïga films the village over a year as it hopes for a borehole that would change its life.

It''s a quiet, beautifully shot documentary about the human cost of climate change, seen from a place that has done almost nothing to cause it. It focuses on children, and on what lack of water takes from their education and their future.'),
('Racionais: Das Ruas de São Paulo pro Mundo',2022,'Juliana Vicente',array['vicente']::text[],'Juliana Vicente''s documentary follows Racionais MC''s, the São Paulo rap group that became the voice of Brazil''s peripheries from the late 1980s, from their beginnings in the city''s poorest neighbourhoods to their status as a national institution.

The group''s songs about police violence, racism and life on the margins changed Brazilian popular culture, and the film treats their story as part of the country''s political history. It''s essential for understanding Black Brazilian music and its fight to be heard.'),
('Hair Piece: A Film for Nappyheaded People',1984,'Ayoka Chenzira',array['chenzira']::text[],'Ayoka Chenzira''s short animated satire looks at the products, rules and anxieties that surround Black women''s hair, from hot combs to relaxers, set against a soundtrack of popular music. It''s funny and pointed, and only a few minutes long.

It''s considered one of the first animated films made by an African American woman, and it anticipates decades of conversations about natural hair and beauty standards. It''s a small film with a big afterlife in classrooms and screenings.'),
('Water Ritual #1: An Urban Rite of Purification',1979,'Barbara McCullough',array['mccullough']::text[],'Barbara McCullough''s short film shows a young woman performing a private ritual in a ruined house in Watts, Los Angeles, her movements drawing on African spiritual traditions. It has almost no dialogue and is built from gesture and atmosphere.

Made as part of the L.A. Rebellion, the group of Black filmmakers who emerged from UCLA in the 1970s, it''s one of the movement''s most experimental works. It''s about healing and reclaiming space, and about what ritual can mean in a city that has neglected its people.'),
('The Giverny Document',2019,'Ja''Tovia Gary',array['gary']::text[],'Ja''Tovia Gary asks Black women on the streets of Harlem whether they feel safe, and sets their answers beside footage of herself in Claude Monet''s gardens at Giverny, archive of Nina Simone, and the livestreamed aftermath of a police shooting. The film moves between documentary and collage.

It''s an experimental work about safety, beauty and who is allowed to rest. Gary uses hand-painted film and repetition to make the viewer stay with images we''re used to scrolling past.'),
('Niaye',1964,'Ousmane Sembène',array['sembène']::text[],'In a Senegalese village, a young girl becomes pregnant, and the truth about who is responsible threatens the whole order of the community. A griot narrates as the elders try to bury the scandal to protect those in authority.

Ousmane Sembène''s second short film, made just after Borom Sarret, is already full of the themes he would return to for forty years: the hypocrisy of the powerful, the vulnerability of women, and a storyteller''s view of a society at a turning point. It''s a stark, unsparing parable told in black and white.'),
('Tauw',1970,'Ousmane Sembène',array['sembène']::text[],'A twenty-year-old man in Dakar looks for work that doesn''t come, quarrels with his father and faces a girlfriend who is pregnant and afraid. Ousmane Sembène follows him through one day in the city.

It''s a short, sharp portrait of a generation that came of age after independence and found the promises of the new nation already narrowing. Sembène''s attention to unemployment, generational conflict and the place of young women gives this small film a weight beyond its length.'),
('Jom',1982,'Ababacar Samb-Makharam',array['samb-makharam']::text[],'''Jom'' means dignity in Wolof, and Ababacar Samb-Makharam''s film follows a griot who links a present-day factory strike in Dakar to stories of resistance from Senegal''s past, including a prince who refused to bow to colonial authority.

The film moves fluidly between eras, using the griot''s oral tradition as its structure. It''s a reflection on how a people keep their self-respect under domination, and it''s one of the most ambitious Senegalese films of its decade.'),
('Tableau Ferraille',1997,'Moussa Sene Absa',array['absa']::text[],'In a seaside town near Dakar named after a scrapheap, an ambitious man rises in politics with the support of his two wives, then falls when corruption closes in around him. The singer Ismaël Lô plays the lead.

Moussa Sene Absa shoots the story in bold colours with music at its centre, mixing melodrama and political fable. It''s about how public life corrupts private loyalty, and about the women who carry the cost when a man''s ambitions collapse.'),
('A Thousand Suns',2013,'Mati Diop',array['diop']::text[],'Mati Diop returns to Magaye Niang, who played the young lover in Touki Bouki, the 1973 classic by her uncle Djibril Diop Mambéty. Forty years later he is a cattle herder in Dakar, and the film follows him through a day and a night as he remembers the woman he once nearly left Senegal with.

Part documentary and part dream, it''s a meditation on what films leave behind in the people who made them. It''s also a young director''s conversation with her family''s legacy, and a hint of the poetry she would bring to Atlantics.'),
('Soleil Ô',1970,'Med Hondo',array['hondo']::text[],'A young man from West Africa arrives in Paris full of hope and meets a wall of rejection: jobs closed to him, rooms that won''t rent, and a casual racism that grows more brutal the longer he stays. Med Hondo, a Mauritanian immigrant who worked menial jobs in France, built the film from his own experience.

It''s furious, inventive and full of satire, mixing animation, songs and direct address. It won the Golden Leopard at Locarno, was largely forgotten for decades, and was restored by The Film Foundation''s African Film Heritage Project. It''s one of the founding works of African cinema.'),
('Cabascabo',1968,'Oumarou Ganda',array['ganda']::text[],'A soldier comes home to Niger after fighting for France in Indochina, spends his savings on friends and parties, and finds himself alone and rejected once the money runs out. Oumarou Ganda, a veteran himself, wrote, directed and starred in the story.

It''s a sober, personal film about the men Africa sent to fight colonial wars and what happened to them on their return. Ganda went on to become one of Niger''s most important directors, and this first feature shows his gift for moral stories.'),
('Le Wazzou polygame',1971,'Oumarou Ganda',array['ganda']::text[],'An older, prosperous man returning from pilgrimage decides to take a much younger second wife, with consequences for both women and for the young woman''s own hopes. Oumarou Ganda directs and stars in this short drama, in Zarma.

It won the grand prize at the 1972 FESPACO festival in Ouagadougou, the first official winner of what became Africa''s most important film award. It''s a clear-eyed look at polygamy and the place of young women in a changing society.'),
('Le Retour d''un aventurier',1966,'Moustapha Alassane',array['alassane']::text[],'A young man returns to his village in Niger from a trip abroad with a trunk of cowboy costumes, and his friends start living out a western, horses and all, until the game turns into trouble. Moustapha Alassane made it as a playful, short comedy.

It''s often called the first African western, and it''s also a sly comment on how imported films shape young people''s dreams. Alassane, a pioneer of animation and fiction in Niger, gives it a lightness that makes its point without preaching.'),
('Finzan',1990,'Cheick Oumar Sissoko',array['sissoko']::text[],'In a village in Mali, a widow refuses to marry her late husband''s brother as custom demands, and a young girl is pressured toward excision. Cheick Oumar Sissoko tells both stories with a mix of comedy and anger.

It''s a film about women''s resistance to traditions that control their bodies, made with a sense of humour that never softens its point. It became one of the best-known Malian films of its time and is still a reference point for cinema about women''s rights in West Africa.'),
('O Ka',2015,'Souleymane Cissé',array['cissé']::text[],'Souleymane Cissé''s documentary is about his own family, evicted from the house in Bamako where they had lived for generations after a legal dispute. Cissé reconstructs the case with family members and performers, mixing interviews with staged scenes.

It''s a personal film from one of Africa''s great directors, made late in his career, about land, inheritance and justice in modern Mali. The title means ''our house''.'),
('Rostov-Luanda',1997,'Abderrahmane Sissako',array['sissako']::text[],'Abderrahmane Sissako travels to Angola looking for a friend he met when they were both students in the Soviet Union, in the city of Rostov. The search takes him through a country emerging from decades of war.

Part travel diary and part essay, the film is about the friendships and ideals of a generation of Africans who studied in the Eastern bloc, and what became of them. It''s an early sign of the gentle, searching style that would shape Sissako''s later features.'),
('Le Cri du cœur',1994,'Idrissa Ouédraogo',array['ouédraogo']::text[],'An eleven-year-old boy leaves Mali to join his father in Lyon, and in his new city he starts seeing a hyena that no one else can see. Only a lonely Frenchman, played by Richard Bohringer, takes his visions seriously.

Idrissa Ouédraogo''s first film made in Europe is a tender story of exile and friendship, about the parts of home a child carries into a new life. It treats the boy''s fears and imagination with respect, and finds magic in a cold place.'),
('Rabi',1992,'Gaston Kaboré',array['kaboré']::text[],'A young boy in a Burkinabè village finds a tortoise and keeps it, learning about patience, responsibility and the natural world from an elderly friend. Gaston Kaboré tells the story with simplicity and calm.

It''s a children''s film in the best sense, built on observation of village life and on the relationship between generations. Kaboré, one of the founders of Burkinabè cinema, makes something gentle and lasting out of very little.'),
('Abusuan',1972,'Henri Duparc',array['duparc']::text[],'An Ivorian executive returns home after fifteen years of study in France and visits his family''s village, where relatives see him as their hope and lean on him for school fees, jobs and favours. ''Abusuan'' means family.

Henri Duparc, best known for his comedies, uses this story to look at the gap between an educated elite and the communities they come from, and at the weight of obligation. It''s an early, sharp portrait of the pressures of success in post-independence Côte d''Ivoire.'),
('La Femme au couteau',1969,'Timité Bassori',array['bassori']::text[],'A young intellectual is haunted by the image of a woman with a knife, a vision that comes between him and the women he desires. Timité Bassori directs and plays the lead in this black-and-white psychological drama.

It''s one of the first Ivorian features, and unusual for its time in turning inward, toward dreams, sexuality and the mind of a man caught between cultures. It''s a rare example of early African cinema working in the language of psychological modernism.'),
('Pousse-Pousse',1975,'Daniel Kamwa',array['kamwa']::text[],'In Douala, a young man who earns his living pushing a cart wants to marry the woman he loves, but her family''s demands for a bride price keep growing. Daniel Kamwa directs and plays the lead in this comedy.

It was a major popular success in Cameroon and is remembered as one of the first African comedies made for a home audience. Under the laughter, it''s a pointed look at how money and family expectations shape marriage.'),
('Chef!',1999,'Jean-Marie Teno',array['teno']::text[],'Jean-Marie Teno begins with a crowd beating a young man accused of theft at a village celebration, and from there examines the idea of the ''chef'', the boss, in Cameroon: the chief, the president, the husband, the father.

It''s a sharp, personal documentary essay about authority at every level of society, and how power abused at the top is echoed in homes and streets. Teno''s dry voice-over makes it both angry and funny.'),
('Bye Bye Africa',1999,'Mahamat-Saleh Haroun',array['haroun']::text[],'Mahamat-Saleh Haroun plays himself, a filmmaker who returns from France to Chad after his mother''s death and tries to make a film in a country where cinemas have closed and war has scarred the cities. Fiction and documentary blur together.

It''s a film about the difficulty of making films in Africa, and about why it matters to try. Haroun''s first feature, it announced a director who would go on to win prizes at Cannes, and it''s a quietly powerful reflection on images and memory.'),
('Juju Factory',2007,'Balufu Bakupa-Kanyinda',array['bakupa-kanyinda']::text[],'Kongo, a Congolese writer in the Matongé district of Brussels, is writing a travel book his editor wants to fill with exotic colour. Instead he is pulled toward the people around him and toward the ghosts of Congo''s colonial history.

Balufu Bakupa-Kanyinda''s film is a reflection on who gets to tell African stories in Europe, and at what price. Its performances won prizes at African and European festivals, and it''s a rare film about the Congolese diaspora in Belgium.'),
('Le Silence de la forêt',2003,'Bassek Ba Kobhio',array['kobhio','ouénangaré']::text[],'A Central African civil servant, disillusioned with life in the city, goes to live among a Pygmy community in the forest, intending to educate them, and slowly realises how much he has to learn. Based on a novel by Étienne Goyémidé, it was directed by Bassek Ba Kobhio and Didier Ouénangaré.

It''s one of the very few features made in the Central African Republic, and a thoughtful film about prejudice within Africa itself: the contempt of the urban elite for forest peoples, and the humility needed to see them as equals.'),
('Saworoide',1999,'Tunde Kelani',array['kelani']::text[],'In the kingdom of Jogbo, a sacred drum is said to strike down any king who takes the throne without the proper rites. A new ruler skips them, sells the forest to timber merchants and brings in soldiers to protect his power, until the drum is heard.

Tunde Kelani''s Yoruba-language film is a parable about corruption and military rule in Nigeria, told through tradition and myth. It''s one of the most admired works of Nigerian popular cinema, proof that home video could carry serious political ideas.'),
('Agogo Eewo',2002,'Tunde Kelani',array['kelani']::text[],'Tunde Kelani''s sequel to Saworoide returns to Jogbo, where a new generation of chiefs must swear an oath of honesty on the ''gong of taboo'' before taking office. Once again, greed tests the town''s institutions.

Made as Nigeria returned to civilian rule, it asks whether a new democracy can hold its leaders to account. Like its predecessor, it uses Yoruba tradition to talk about the present, with humour and a deep faith in the culture''s moral resources.'),
('Maami',2011,'Tunde Kelani',array['kelani']::text[],'On the eve of a World Cup match, a celebrated footballer remembers his childhood in Abeokuta, raised in poverty by his devoted single mother. Adapted from a novel by Femi Osofisan, the film moves between past and present.

Tunde Kelani makes it a tribute to the sacrifices of mothers, and a gentle portrait of Yoruba family life. It''s sentimental in the best sense, and anchored by Funke Akindele''s performance as the mother.'),
('Mokalik',2019,'Kunle Afolayan',array['afolayan']::text[],'An eleven-year-old boy from a comfortable Lagos home spends a day as an apprentice at a busy mechanics'' village, where he meets workers, traders and boys his own age whose lives are nothing like his.

Kunle Afolayan''s Yoruba-language film is a slice of life, built on the energy and humour of the workshop. It''s a film about class, work and respect, and about what a child learns when he''s allowed to see how other people live.'),
('Swallow',2021,'Kunle Afolayan',array['afolayan']::text[],'In 1980s Lagos, a young bank worker loses her job and, with her flatmate, is drawn toward the world of drug smuggling, where women carry drugs in their bodies. Adapted from Sefi Atta''s novel, Kunle Afolayan''s film is set during a period of economic hardship and military rule.

It''s a story about desperation and choice, focused on a young woman trying to keep her dignity when options run out. It brings a literary sensibility and period detail to Nigerian film.'),
('Ìjọ̀gbọ̀n',2023,'Kunle Afolayan',array['afolayan']::text[],'Four teenagers in a rural Nigerian village find a stash of rough diamonds, and their discovery sets off a chain of trouble involving greedy adults and dangerous men. The Yoruba title means ''trouble''.

Kunle Afolayan''s coming-of-age adventure is a story about friendship and temptation, with young leads at its centre. It''s a lively film about growing up and learning what wealth can cost.'),
('Afamefuna: An Nwa Boi Story',2023,'Kayode Kasum',array['kasum']::text[],'A young Igbo man works for years as an apprentice under a successful trader, hoping to be ''settled'' with the capital to start his own business, as the system promises. When his mentor dies, his future becomes uncertain, and a crime casts suspicion on him.

Kayode Kasum''s drama centres the Igbo apprenticeship system, known as Imu Ahia, which has built generations of businesses. It''s a film about loyalty, ambition and a model of community that is rarely shown on screen.'),
('Funmilayo Ransome-Kuti',2024,'Bolanle Austen-Peters',array['austen-peters']::text[],'Funmilayo Ransome-Kuti was a teacher, campaigner and leader of women''s resistance in colonial Nigeria, organising market women against unjust taxes in Abeokuta and later becoming one of the country''s best-known activists. She was also the mother of the musician Fela Kuti.

Bolanle Austen-Peters'' biographical drama tells her story from the 1940s, with Kehinde Bankole in the title role. It''s a celebration of a woman whose courage helped shape Nigeria''s independence movement, and whose life is too little known outside the country.'),
('Breath of Life',2023,'BB Sasore',array['sasore']::text[],'A wealthy man who has walked away from his faith after a terrible loss crosses paths with a young man who wants to become a preacher, and their unlikely friendship tests both of them. BB Sasore wrote and directed this drama set in Nigeria across several decades.

It''s a film about grief, faith and second chances, made with care for its period settings and performances. It became one of the most celebrated Nigerian films of its year.'),
('Rage',1999,'Newton Aduaka',array['aduaka']::text[],'A mixed-race teenager in London, nicknamed Rage, wants to make a hip-hop record with his friends, and sets out to raise the money by any means. Newton Aduaka''s debut is set in the streets and estates of the city.

Made on a tiny budget, it''s one of the earliest British films about hip-hop culture and about young Black and mixed-race Londoners. Aduaka would go on to win the top prize at FESPACO with Ezra, and this first feature already shows his directness.'),
('Sinking Sands',2011,'Leila Djansi',array['djansi']::text[],'In a Ghanaian village, a young teacher''s marriage turns violent after her husband is disfigured in an accident and his bitterness takes over their home. Leila Djansi tells the story of her attempts to hold on and to leave.

It''s a sober drama about domestic abuse, filmed with restraint and focused on the woman''s experience. It was widely praised at African film festivals and helped bring the subject into public conversation in Ghana.'),
('Kwaku Ananse',2013,'Akosua Adoma Owusu',array['owusu']::text[],'A young woman returns to Ghana for her father''s funeral and discovers he lived a double life. The story is woven with the folktale of Kwaku Ananse, the spider trickster of Akan tradition.

Akosua Adoma Owusu''s short film is lyrical and inventive, blending folklore and personal grief. It won the award for best short film at the Africa Movie Academy Awards and was widely shown at international festivals.'),
('Kati Kati',2016,'Mbithi Masya',array['masya']::text[],'A young woman wakes up in a strange camp in the Kenyan countryside with no memory of how she got there, and learns that everyone around her is dead. In this afterlife, the residents must face what they did in life before they can move on.

Mbithi Masya''s debut, produced through the One Fine Day Films workshop in Nairobi, won the FIPRESCI prize at the Toronto International Film Festival. It''s a haunting, original film about guilt, forgiveness and the stories we tell ourselves.'),
('Neria',1993,'Godwin Mawuru',array['mawuru']::text[],'When her husband dies, a woman in Zimbabwe finds that his brother intends to take their house, savings and even their children, as custom seems to allow. Neria decides to fight for what''s hers.

Written by Tsitsi Dangarembga and directed by Godwin Mawuru, the film was a landmark in Zimbabwe, where it was widely seen and discussed. Oliver Mtukudzi wrote the music and plays a role. It remains one of the most important African films about women''s property rights.'),
('Mother, I Am Suffocating. This Is My Last Film About You.',2019,'Lemohang Jeremiah Mosese',array['mosese']::text[],'Lemohang Jeremiah Mosese, from Lesotho, made this black-and-white essay film as a letter to his mother and to his homeland, built from staged tableaux, poetry and images of people carrying a cross through the landscape.

It premiered at the Berlin Film Festival and announced a bold voice; Mosese followed it with This Is Not a Burial, It''s a Resurrection. It''s a film about leaving, about the colonial weight of religion and about love for a place that is hard to stay in.'),
('Nothing But the Truth',2008,'John Kani',array['kani']::text[],'In Port Elizabeth, a librarian prepares for his brother''s funeral. The brother, an anti-apartheid hero, died in exile in London, and the two never resolved their rivalry. As the ashes arrive, old grievances surface.

John Kani adapted his own award-winning play and plays the lead. It''s a film about the Truth and Reconciliation era seen from inside a family, asking what happens to the people who stayed and did the quieter work.'),
('Hard to Get',2014,'Zee Ntuli',array['ntuli']::text[],'A young man from a South African township falls for a reckless, magnetic woman, and their romance becomes a run from dangerous people. Zee Ntuli''s first feature mixes love story, crime film and road movie.

It''s energetic and stylish, part of a new wave of South African genre films made by Black directors with local audiences in mind. It''s a film about desire and danger, with a strong sense of place.'),
('Mangrove',2020,'Steve McQueen',array['mcqueen']::text[],'In 1970, the Mangrove restaurant in London''s Notting Hill was a meeting place for the Caribbean community, and a constant target of police raids. When its owner and local activists marched in protest, nine of them were charged with inciting a riot. Their trial became a landmark.

Steve McQueen''s film, part of his Small Axe series, follows Frank Crichlow and the Mangrove Nine, played by Shaun Parkes, Letitia Wright and Malachi Kirby among others. It''s a gripping courtroom drama about a community fighting for the right to exist, and about a victory that Britain long preferred to forget.'),
('Lovers Rock',2020,'Steve McQueen',array['mcqueen']::text[],'Over one night in 1980, a house party in West London fills with music, dancing and the slow, sweet reggae known as lovers rock. Two young people meet, and the film follows them, and everyone around them, until morning.

The most celebrated film in Steve McQueen''s Small Axe series has almost no plot and needs none. Its centrepiece, a crowd singing Janet Kay''s ''Silly Games'' long after the record stops, is one of the most joyful scenes in recent cinema. It''s a film about Black British joy and the safe spaces people made for themselves.'),
('Blood Ah Go Run',1982,'Menelik Shabazz',array['shabazz']::text[],'In January 1981, a house fire in New Cross, South London, killed thirteen young Black people at a birthday party. The police investigation was widely seen as indifferent, and the community organised the Black People''s Day of Action, when thousands marched through London.

Menelik Shabazz''s documentary records the anger and grief of those weeks as they happened. It''s a crucial document of Black British history, made from inside the community, at a moment when mainstream media was looking away.'),
('Donoma',2010,'Djinn Carrénard',array['carrénard']::text[],'Several stories of love and desire cross in Paris: a teacher and a provocative student, a young woman who chooses a stranger as her partner, a woman searching for faith. Djinn Carrénard made the film with friends and a tiny budget, and it became famous for having cost almost nothing.

Its looseness and energy made it a small sensation in French independent cinema. It''s a film about intimacy and chance, full of young, diverse Parisians who rarely appeared on French screens at the time.'),
('The Planet of Junior Brown',1997,'Clement Virgo',array['virgo']::text[],'Two boys in Toronto skip school and find refuge in a hidden basement room, where a janitor has built a model of the solar system. One of them is a gifted, troubled musician, and his friend tries to protect him as his world closes in.

Clement Virgo adapted Virginia Hamilton''s award-winning novel for young readers. It''s a tender film about friendship and mental health among young Black boys, made with care for the inner lives of children.'),
('Black Cop',2017,'Cory Bowles',array['bowles']::text[],'A Black police officer who has spent his career trying to be a good cop is pushed past breaking point after a humiliating incident, and turns the tactics of policing back on the white residents of his city. Ronnie Rowe Jr. plays the lead.

Cory Bowles expanded his own short into this sharp, unsettling satire. It''s a provocation that asks how it feels to be on the other side of profiling, and what it does to a person to belong to two worlds that distrust each other.'),
('Haitian Corner',1988,'Raoul Peck',array['peck']::text[],'In Brooklyn, a Haitian poet who was tortured as a political prisoner in Haiti recognises one of his torturers in the street and becomes consumed by the idea of revenge. Around him, the Haitian community in New York tries to live with memories of the dictatorship.

Raoul Peck''s first feature is a film about exile and the past that follows people across borders. Many of the themes of his later work, power, violence and how history is remembered, are already present here.'),
('Smile Orange',1976,'Trevor Rhone',array['rhone']::text[],'At a beach resort in Jamaica, a quick-talking waiter named Ringo hustles the tourists, the management and the women he meets, teaching a new colleague how to survive by charm and scheming. Trevor Rhone adapted his own popular stage comedy.

Shot after The Harder They Come, it''s one of the founding works of Jamaican cinema and a satire of the tourist economy that depends on Jamaicans performing a smile. It''s broad and very funny, and its targets are still recognisable.'),
('Better Mus'' Come',2010,'Storm Saulter',array['saulter']::text[],'In 1970s Kingston, as political parties arm rival neighbourhoods, a young man caught between gangs and the woman he loves tries to find a way out. The story draws on the Green Bay massacre of 1978, when soldiers ambushed young men from one community.

Storm Saulter''s debut is a stylish, serious film about how politics turned young Jamaicans into soldiers for causes that didn''t serve them. It helped launch a new generation of Jamaican filmmaking.'),
('Bim',1974,'Hugh A. Robertson',array['robertson']::text[],'In Trinidad, an Indo-Trinidadian boy grows up angry and marginalised, falls into crime and becomes a feared figure in politics and the streets. The film follows Bim through the decades when the island moved toward independence.

Directed by Hugh A. Robertson, a Trinidadian who had worked as an editor in Hollywood, Bim is one of the first feature films made in Trinidad and Tobago. It''s a frank look at the tensions between the island''s communities, and a landmark of Caribbean cinema.'),
('Iré a Santiago',1964,'Sara Gómez',array['gómez']::text[],'Sara Gómez''s short documentary is a portrait of Santiago de Cuba, the island''s most African city: its streets, music, carnival and people. It''s affectionate and playful, with a poet''s eye for detail.

Gómez, an Afro-Cuban filmmaker and the first woman to direct a feature at Cuba''s national film institute, made work that brought Afro-Cuban life to the centre of revolutionary cinema. This early film shows her interest in the people the official story tended to leave out.'),
('El otro Francisco',1974,'Sergio Giral',array['giral']::text[],'Sergio Giral revisits the 19th-century Cuban novel Francisco, a romantic story about an enslaved man that was written as an abolitionist work. The film restages the novel and then shows what it left out: the brutal economics of the sugar plantation and the resistance of enslaved people.

It''s a film about how stories of slavery get told and by whom. It opened a trilogy by Giral about slavery and resistance in Cuba, and is one of the most important works of Afro-Cuban cinema.'),
('Maluala',1979,'Sergio Giral',array['giral']::text[],'In the mountains of eastern Cuba, communities of people who escaped slavery, called palenques, fight to keep their freedom as the colonial authorities try to destroy or divide them. Sergio Giral tells the story from the side of the cimarrones.

The third part of Giral''s trilogy about slavery, it''s a vivid film about resistance and the politics of survival, and about the choices free communities faced when offered deals by the powers that wanted them gone.'),
('Amor Maldito',1984,'Adélia Sampaio',array['sampaio']::text[],'A woman stands trial after her lover kills herself, and the court and the press turn the case into a judgement on their relationship. Adélia Sampaio''s film is based on a real case.

It''s the first feature film directed by a Black woman in Brazil, made under the military dictatorship with almost no support. It''s also one of the earliest Brazilian films to treat a lesbian relationship seriously. Long overlooked, it has been rediscovered as a key work of Brazilian cinema.'),
('Ela Volta na Quinta',2014,'André Novais Oliveira',array['oliveira']::text[],'In Contagem, near Belo Horizonte, a couple married for decades face a crisis, and their two grown sons watch their family shift. André Novais Oliveira cast his own parents and brother as versions of themselves.

The result is tender and funny, a fiction that feels like home movies. It''s part of a wave of films from Contagem''s Filmes de Plástico collective that bring working-class Black Brazilian life to the screen with warmth and patience.'),
('Dolemite',1975,'D''Urville Martin',array['martin']::text[],null),
('Several Friends',1969,'Charles Burnett',array['burnett']::text[],null),
('Hour Glass',1971,'Haile Gerima',array['gerima']::text[],null),
('Child of Resistance',1972,'Haile Gerima',array['gerima']::text[],null),
('Four Women',1975,'Julie Dash',array['dash']::text[],null),
('The Diary of an African Nun',1977,'Julie Dash',array['dash']::text[],null),
('Daydream Therapy',1977,'Bernard Nicolas',array['nicolas']::text[],null),
('Your Children Come Back to You',1979,'Alile Sharon Larkin',array['larkin']::text[],null),
('I & I: An African Allegory',1979,'Ben Caldwell',array['caldwell']::text[],null),
('A Different Image',1982,'Alile Sharon Larkin',array['larkin']::text[],null),
('My Brother''s Wedding',1983,'Charles Burnett',array['burnett']::text[],null),
('Straight Out of Brooklyn',1991,'Matty Rich',array['rich']::text[],null),
('Hav Plenty',1997,'Christopher Scott Cherot',array['cherot']::text[],null),
('How Stella Got Her Groove Back',1998,'Kevin Rodney Sullivan',array['sullivan']::text[],null),
('Down in the Delta',1998,'Maya Angelou',array['angelou']::text[],null),
('Two Can Play That Game',2001,'Mark Brown',array['brown']::text[],null),
('Something New',2006,'Sanaa Hamri',array['hamri']::text[],null),
('Jumping the Broom',2011,'Salim Akil',array['akil']::text[],null),
('Kinyarwanda',2011,'Alrick Brown',array['brown']::text[],null),
('Kokomo City',2023,'D. Smith',array['smith']::text[],null),
('His House',2020,'Remi Weekes',array['weekes']::text[],null),
('The Blackening',2022,'Tim Story',array['story']::text[],null),
('La Femme au couteau',1969,'Timité Bassori',array['bassori']::text[],null),
('Soleil Ô',1970,'Med Hondo',array['hondo']::text[],null),
('Kodou',1971,'Ababacar Samb-Makharam',array['samb']::text[],null),
('Muna Moto',1975,'Jean-Pierre Dikongué-Pipa',array['dikongu']::text[],null),
('Aiye',1979,'Ola Balogun',array['balogun']::text[],null),
('Glamour Girls',1994,'Chika Onukwufor',array['onukwufor']::text[],null),
('Rattlesnake',1995,'Amaka Igwe',array['igwe']::text[],null),
('Domitilla',1996,'Zeb Ejiro',array['ejiro']::text[],null),
('Thunderbolt',2000,'Tunde Kelani',array['kelani']::text[],null),
('Osuofia in London',2003,'Kingsley Ogoro',array['ogoro']::text[],null),
('Ije',2010,'Chineze Anyaene',array['anyaene']::text[],null),
('Zinabu',1987,'William Akuffo',array['akuffo']::text[],null),
('Step Forward Youth',1977,'Menelik Shabazz',array['shabazz']::text[],null),
('Territories',1984,'Isaac Julien',array['julien']::text[],null),
('The People''s Account',1988,'Milton Bryan',array['bryan']::text[],null),
('Twilight City',1989,'Reece Auguiste',array['auguiste']::text[],null),
('Anuvahood',2011,'Adam Deacon',array['deacon']::text[],null),
('Brother to Brother',2004,'Rodney Evans',array['evans']::text[],null)
) as v(title, year, director_name, director_keys, synopsis)
where not exists (
  select 1 from public.films f
  where abs(coalesce(f.year, 0) - v.year) <= 1
    and (lower(f.title) = lower(v.title) or lower(coalesce(f.original_title, '')) = lower(v.title))
)
on conflict do nothing;
