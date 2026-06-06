// 50 of the most commonly searched questions about the IPL, grouped by topic.
// Used to power the /faq page (SEO + AEO: AI search engines surface Q&A content directly).

export const FAQ_CATEGORIES = [
  {
    category: 'About the IPL',
    items: [
      {
        q: 'What is the IPL?',
        a: 'The Indian Premier League (IPL) is a professional Twenty20 (T20) cricket league in India, organised by the Board of Control for Cricket in India (BCCI). Launched in 2008, it features city- and state-based franchise teams competing in a round-robin league stage followed by playoffs, and is widely regarded as the most-watched and most valuable cricket league in the world.',
      },
      {
        q: 'When did the IPL start?',
        a: 'The IPL was founded in 2007 and held its inaugural season in April–May 2008, with Rajasthan Royals winning the first title.',
      },
      {
        q: 'Who owns the IPL?',
        a: 'The IPL is owned and run by the Board of Control for Cricket in India (BCCI), which licenses individual franchises to private owners and corporate groups for each city-based team.',
      },
      {
        q: 'Who founded the IPL?',
        a: 'The IPL was conceived and launched by Lalit Modi, then a vice-president of the BCCI, with the backing of the BCCI as its governing body.',
      },
      {
        q: 'How many teams are in the IPL?',
        a: 'The IPL currently has 10 franchise teams, each representing a city or state in India: Chennai Super Kings, Mumbai Indians, Royal Challengers Bengaluru, Kolkata Knight Riders, Delhi Capitals, Punjab Kings, Rajasthan Royals, Sunrisers Hyderabad, Gujarat Titans, and Lucknow Super Giants.',
      },
      {
        q: 'When is the IPL played every year?',
        a: 'The IPL is typically held annually between March/April and May, fitting into a roughly two-month window in the Indian cricket calendar, though exact dates vary by season due to scheduling around international tours and elections.',
      },
      {
        q: 'How long is an IPL match?',
        a: 'An IPL match is a Twenty20 (T20) game — each team bats for a maximum of 20 overs per innings — and typically lasts around 3 to 3.5 hours including the mid-innings break and strategic time-outs.',
      },
      {
        q: 'Why is the IPL so popular?',
        a: 'The IPL combines top international and domestic talent, high-scoring T20 cricket, big-budget franchises, massive media rights deals, Bollywood and corporate ownership, and an electric stadium atmosphere — making it the second-richest sports league in the world by per-match value.',
      },
    ],
  },
  {
    category: 'Format & Rules',
    items: [
      {
        q: 'How does the IPL points table and playoff system work?',
        a: 'All teams play each other twice (home and away) in a round-robin league stage. The top four teams advance to the playoffs: Qualifier 1 (1st vs 2nd) sends the winner straight to the final, Eliminator (3rd vs 4th) is a knockout, Qualifier 2 pits the Eliminator winner against the Qualifier 1 loser, and the winner of Qualifier 2 meets the Qualifier 1 winner in the final.',
      },
      {
        q: 'What happens if an IPL match ends in a tie?',
        a: 'If scores are level at the end of both innings, the match is decided by a Super Over — a one-over eliminator for each side. If the Super Over also ties, it is repeated until a winner emerges.',
      },
      {
        q: 'What is the Impact Player rule in the IPL?',
        a: 'Introduced in 2023, the Impact Player rule allows each team to nominate up to four substitutes before the match and bring one of them on as a full playing-XI replacement at any point — letting teams field 12 players in effect (one as a pure batter or bowler) and adapt their combination based on conditions or the toss.',
      },
      {
        q: 'How many overseas players can play in an IPL match?',
        a: 'A team can field a maximum of four overseas (non-Indian) players in its starting XI, though squads can contain up to eight overseas players in total.',
      },
      {
        q: 'What is the Decision Review System (DRS) in the IPL?',
        a: 'The IPL uses the Decision Review System, allowing each team a limited number of unsuccessful reviews per innings to challenge on-field umpiring decisions using ball-tracking, UltraEdge and replay technology, similar to international cricket.',
      },
      {
        q: 'What is the Duckworth-Lewis-Stern (DLS) method and when is it used in the IPL?',
        a: 'The DLS method is a mathematical formula used to recalculate a revised target score for the team batting second when an IPL match is shortened by rain or other interruptions, ensuring a fair result based on overs and wickets remaining.',
      },
      {
        q: 'What are strategic time-outs in the IPL?',
        a: 'Each team gets one mandatory strategic time-out of two-and-a-half minutes per innings — the bowling side takes theirs between overs 6 and 9, and the batting side between overs 13 and 16 — used for tactical discussions and broadcast breaks.',
      },
      {
        q: 'How many players are in an IPL squad?',
        a: 'Each IPL franchise can register a minimum of 18 and a maximum of 25 players (including a maximum of eight overseas players) for a season, built through the auction, retentions, and trades.',
      },
      {
        q: 'What is the salary cap / purse limit in the IPL?',
        a: 'Each IPL franchise operates under a total salary cap (the "purse") set by the BCCI for player acquisitions — a figure that has risen steadily over the years (around ₹120 crore for the 2025 mega-auction cycle) — and teams must use a minimum percentage of it on player salaries.',
      },
    ],
  },
  {
    category: 'Auction & Teams',
    items: [
      {
        q: 'How does the IPL player auction work?',
        a: 'Before each season (or mega-auction cycle), eligible players register and are grouped into sets by role and base price. Franchises bid against each other in real time, with the highest bidder securing the player, all while staying within their total salary purse and squad-composition rules.',
      },
      {
        q: 'What is a "Right to Match" (RTM) card in the IPL auction?',
        a: 'The Right to Match card lets a franchise retain a player it previously had by matching the highest bid made for that player by another team during the auction — giving the original team a final chance to keep them.',
      },
      {
        q: 'What does "player retention" mean in the IPL?',
        a: 'Retention allows a franchise to keep a certain number of existing players ahead of a mega-auction — at pre-set price slabs decided by the BCCI — instead of releasing them back into the auction pool, helping teams preserve their core while still rebuilding.',
      },
      {
        q: 'Can IPL teams trade players with each other?',
        a: 'Yes. Outside of the auction window, franchises can trade players directly with one another (with the player\'s consent), which is commonly used to fill specific squad gaps or offload players who no longer fit team plans.',
      },
      {
        q: 'Which IPL teams have been discontinued or renamed?',
        a: 'Several original franchises no longer exist in their old form: Deccan Chargers (Hyderabad) and Pune Warriors India were terminated by the BCCI, Kochi Tuskers Kerala played only one season before its contract was revoked, Rising Pune Supergiant was a temporary replacement team, and Royal Challengers Bangalore was rebranded as Royal Challengers Bengaluru in 2024 following the city\'s renaming.',
      },
      {
        q: 'Which two teams were added as IPL expansion franchises?',
        a: 'Gujarat Titans and Lucknow Super Giants joined the IPL as new franchises ahead of the 2022 season, expanding the league back to 10 teams.',
      },
      {
        q: 'Who owns Mumbai Indians?',
        a: 'Mumbai Indians is owned by Reliance Industries, through its group company Indiawin Sports, headed by Nita Ambani.',
      },
      {
        q: 'Who owns Chennai Super Kings?',
        a: 'Chennai Super Kings is owned by Chennai Super Kings Cricket Limited, a subsidiary of India Cements, with N. Srinivasan as a key figurehead of the franchise.',
      },
      {
        q: 'Which Bollywood celebrities own IPL teams?',
        a: 'Actor Shah Rukh Khan co-owns Kolkata Knight Riders, while Preity Zinta is a co-owner of Punjab Kings — among the most visible celebrity-owned franchises in the league.',
      },
    ],
  },
  {
    category: 'Records & Stats',
    items: [
      {
        q: 'Which team has won the most IPL titles?',
        a: 'Mumbai Indians and Chennai Super Kings are tied as the most successful franchises, with five IPL titles each (MI: 2013, 2015, 2017, 2019, 2020; CSK: 2010, 2011, 2018, 2021, 2023). Royal Challengers Bengaluru and Kolkata Knight Riders have also won multiple recent titles, with RCB claiming back-to-back championships in 2025 and 2026.',
      },
      {
        q: 'Who has scored the most runs in IPL history?',
        a: 'Virat Kohli is the leading run-scorer in IPL history, having amassed more runs across seasons for Royal Challengers Bengaluru/Bengaluru than any other batter, with multiple Orange Cap-winning seasons to his name.',
      },
      {
        q: 'Who has taken the most wickets in IPL history?',
        a: 'Yuzvendra Chahal is the all-time leading wicket-taker in IPL history, edging past long-time leader Dwayne Bravo, with both spinners and pace bowlers like Bhuvneshwar Kumar and Sunil Narine also among the top wicket-takers.',
      },
      {
        q: 'What is the highest individual score in IPL history?',
        a: 'Chris Gayle holds the record for the highest individual score in IPL history with an unbeaten 175 off just 66 balls for Royal Challengers Bangalore against Pune Warriors India in 2013 — still the highest score by any batter in T20 cricket at the time it was made.',
      },
      {
        q: 'What is the highest team total in IPL history?',
        a: 'The headline team-total record has been broken multiple times in recent seasons as scoring rates have climbed; explore the Records section of this site for the most current highest innings total and the match in which it was set.',
      },
      {
        q: 'What is the Orange Cap in the IPL?',
        a: 'The Orange Cap is awarded to the leading run-scorer of an IPL season. The player who tops the season\'s run charts wears the orange cap during subsequent matches as a mark of recognition, with the title going to the player with most runs at the end of the tournament.',
      },
      {
        q: 'What is the Purple Cap in the IPL?',
        a: 'The Purple Cap is awarded to the leading wicket-taker of an IPL season — the bowler who has taken the most wickets across the tournament wears it as a sign of distinction for that campaign.',
      },
      {
        q: 'Who has won the most Orange Caps?',
        a: 'David Warner and Virat Kohli have each won the Orange Cap multiple times, putting them among the most prolific run-scorers in single IPL seasons; check the Insights tab on this site for the full season-by-season Orange Cap roll of honour.',
      },
      {
        q: 'Who has hit the most sixes in IPL history?',
        a: 'Chris Gayle is the all-time leader in sixes in IPL history, having earned the nickname "Universe Boss" for his explosive big-hitting across more than a decade in the league.',
      },
      {
        q: 'What is the fastest century in IPL history?',
        a: 'Chris Gayle also holds the record for the fastest century in IPL history, reaching three figures off just 30 balls during his famous 175* knock in 2013 — a mark that still stands as one of the fastest hundreds in all of T20 cricket.',
      },
      {
        q: 'What is the lowest team total in IPL history?',
        a: 'Royal Challengers Bangalore were dismissed for 49 against Kolkata Knight Riders in 2017 — the lowest completed innings total in IPL history.',
      },
      {
        q: 'Has anyone taken a hat-trick in the IPL?',
        a: 'Yes — several bowlers have taken hat-tricks in IPL history, including Lasith Malinga (who has multiple IPL hat-tricks), Amit Mishra, Yuzvendra Chahal, and others; the Records section of this site lists every IPL hat-trick and its match details.',
      },
    ],
  },
  {
    category: 'Players',
    items: [
      {
        q: 'Who is the most successful captain in IPL history?',
        a: 'MS Dhoni is widely regarded as the most successful captain in IPL history, leading Chennai Super Kings to multiple titles and a finals appearance in most seasons he has captained — a record matched by very few leaders in franchise cricket anywhere.',
      },
      {
        q: 'Is MS Dhoni still playing in the IPL?',
        a: 'Yes — MS Dhoni continues to represent Chennai Super Kings, the only franchise he has ever played for, and remains one of the most popular figures in the league even in the twilight of his playing career.',
      },
      {
        q: 'What is an "uncapped player" in the IPL?',
        a: 'An uncapped player is someone who has not played international cricket for their country at the senior level (no national "cap"). IPL teams often unearth uncapped Indian talent through the auction, giving young domestic players a high-profile stage alongside international stars.',
      },
      {
        q: 'Can international players play in every IPL match?',
        a: 'International players can feature for their franchise as long as they are released by their national boards and not on international duty; availability windows and "no-objection certificates" (NOCs) from boards often shape which overseas stars can play full seasons.',
      },
      {
        q: 'Who was the youngest player to debut in the IPL?',
        a: 'The IPL has repeatedly thrown up teenage sensations — from Sarfaraz Khan and Prithvi Shaw in earlier years to a wave of under-19 talents unearthed via the auction in recent seasons — with the record for youngest debutant being broken several times as scouting has improved.',
      },
      {
        q: 'Which players have won the most Man of the Match awards in the IPL?',
        a: 'Players like AB de Villiers, Chris Gayle, David Warner and Rohit Sharma are among the leading recipients of Man of the Match awards across IPL history, reflecting consistent match-winning performances over many seasons.',
      },
      {
        q: 'Which bowler has the best economy rate in IPL history?',
        a: 'Spinners and death-overs specialists with tight, low-scoring spells — such as Sunil Narine and Rashid Khan in the powerplay and middle overs — are consistently rated among the most economical bowlers across IPL seasons; see the Bowling Records page for up-to-date rankings filtered by minimum overs bowled.',
      },
    ],
  },
  {
    category: 'Venues & Viewing',
    items: [
      {
        q: 'Where can I watch IPL matches live?',
        a: 'IPL matches are broadcast on television and streamed online through the league\'s official broadcast and digital streaming partners in India, alongside regional and international broadcasters depending on your country — check your local sports broadcaster or official streaming app for live coverage and listings.',
      },
      {
        q: 'Which stadium has hosted the most IPL matches?',
        a: 'Iconic venues such as the M. Chinnaswamy Stadium (Bengaluru), Wankhede Stadium (Mumbai), Eden Gardens (Kolkata), MA Chidambaram Stadium (Chennai) and Arun Jaitley Stadium (Delhi) are among the grounds that have hosted the highest number of IPL matches over the years — see the Venues section of this site for exact match counts per ground.',
      },
      {
        q: 'Do IPL matches get played outside India?',
        a: 'Yes — in years affected by elections, scheduling clashes, or other logistical issues (most notably 2009 and 2014, and parts of 2020/21), entire legs or full seasons of the IPL were relocated to South Africa and the UAE.',
      },
      {
        q: 'How is the host city for the IPL final decided?',
        a: 'The BCCI announces the venues for marquee fixtures, including the final, ahead of each season as part of the official schedule — typically rotating among major stadiums and factoring in pitch conditions, capacity, and logistics.',
      },
    ],
  },
  {
    category: 'Records, Trivia & Miscellaneous',
    items: [
      {
        q: 'What does "IPL" stand for?',
        a: 'IPL stands for "Indian Premier League" — the official name of India\'s top T20 franchise cricket competition run by the BCCI.',
      },
      {
        q: 'How much prize money does the IPL winner get?',
        a: 'The IPL distributes substantial prize money each season, with the champions earning the largest share (commonly in the range of ₹20 crore or more), the runners-up receiving a smaller amount, and individual award winners (Orange Cap, Purple Cap, Most Valuable Player, etc.) also receiving cash prizes — league rules require a portion of this to be shared with players.',
      },
      {
        q: 'How are IPL media rights sold and how much are they worth?',
        a: 'The BCCI sells IPL media rights (TV and digital streaming) through a competitive bidding process for multi-year cycles; the most recent rights deals have been valued in the billions of dollars, making the IPL one of the most valuable sports properties per match in the world — comparable to or exceeding many global leagues on a per-game basis.',
      },
      {
        q: 'What is the difference between the IPL and international cricket?',
        a: 'The IPL is a franchise-based domestic league featuring city teams stocked with both Indian and overseas players who compete for their franchise rather than their country, whereas international cricket (Tests, ODIs, T20Is) is played between national teams under the ICC\'s structure.',
      },
      {
        q: 'What is the Women\'s Premier League (WPL) and how is it related to the IPL?',
        a: 'The Women\'s Premier League (WPL), launched in 2023, is the BCCI\'s franchise T20 league for women\'s cricket — run on a similar model to the IPL, with several owners overlapping across both competitions, helping grow the women\'s game in India.',
      },
      {
        q: 'How does the IPL affect international cricket schedules?',
        a: 'Because the IPL window is so high-profile and lucrative, cricket boards around the world increasingly schedule international tours and bilateral series around it, and several boards grant players "no-objection certificates" (NOCs) to participate, making the IPL a major factor in the global cricket calendar.',
      },
      {
        q: 'Why do some players wear different team colours each year?',
        a: 'Because of the auction-and-retention system, players can move between franchises from one season (or auction cycle) to the next — either by being released and re-bought by a different team, traded, or simply not retained — which is why fans often see familiar faces in new team colours.',
      },
      {
        q: 'What is a Super Over in the IPL?',
        a: 'A Super Over is a one-over "mini-match" used to break a tie — each team bats for one over with three wickets in hand, and whichever side scores more runs in their over wins the match; if the Super Over also ties, it is replayed until there is a winner.',
      },
      {
        q: 'How many matches are played in a full IPL season?',
        a: 'A standard 10-team IPL season features 74 league matches (each team plays the others twice across a double round-robin) plus 4 playoff matches, for a total of 78 matches — though the exact number can vary if the format is adjusted for a given year.',
      },
      {
        q: 'What is the "Mauka Mauka" / fan culture around the IPL?',
        a: 'The IPL has cultivated one of the most passionate fan cultures in world sport — with team anthems, catchphrases, viral celebrations, fantasy leagues, and massive social-media engagement that runs throughout the two-month tournament window and beyond.',
      },
    ],
  },
]

export const FAQ_FLAT = FAQ_CATEGORIES.flatMap((c) => c.items)
