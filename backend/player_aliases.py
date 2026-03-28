"""
Comprehensive player alias mapping for IPL Analytics search.

Maps common search terms (lowercase) to the abbreviated database player names.
Includes full names, first names, last names, nicknames, and popular abbreviations.
"""

# Maps common search terms (lowercase) to database player names
PLAYER_ALIASES: dict[str, str] = {
    # ── V Kohli ──────────────────────────────────────────────────────
    "virat": "V Kohli",
    "virat kohli": "V Kohli",
    "kohli": "V Kohli",
    "king kohli": "V Kohli",
    "vk": "V Kohli",
    "vk18": "V Kohli",
    "cheeku": "V Kohli",

    # ── RG Sharma ────────────────────────────────────────────────────
    "rohit": "RG Sharma",
    "rohit sharma": "RG Sharma",
    "hitman": "RG Sharma",
    "ro": "RG Sharma",

    # ── MS Dhoni ─────────────────────────────────────────────────────
    "dhoni": "MS Dhoni",
    "mahendra": "MS Dhoni",
    "mahendra singh dhoni": "MS Dhoni",
    "msd": "MS Dhoni",
    "thala": "MS Dhoni",
    "captain cool": "MS Dhoni",
    "mahi": "MS Dhoni",

    # ── JJ Bumrah ────────────────────────────────────────────────────
    "bumrah": "JJ Bumrah",
    "jasprit": "JJ Bumrah",
    "jasprit bumrah": "JJ Bumrah",
    "boom": "JJ Bumrah",
    "boom boom bumrah": "JJ Bumrah",

    # ── S Dhawan ─────────────────────────────────────────────────────
    "shikhar": "S Dhawan",
    "shikhar dhawan": "S Dhawan",
    "dhawan": "S Dhawan",
    "gabbar": "S Dhawan",

    # ── DA Warner ────────────────────────────────────────────────────
    "warner": "DA Warner",
    "david warner": "DA Warner",
    "david": "DA Warner",
    "bull": "DA Warner",

    # ── SK Raina ─────────────────────────────────────────────────────
    "raina": "SK Raina",
    "suresh": "SK Raina",
    "suresh raina": "SK Raina",
    "mr ipl": "SK Raina",
    "chinna thala": "SK Raina",

    # ── KL Rahul ─────────────────────────────────────────────────────
    "kl rahul": "KL Rahul",
    "kl": "KL Rahul",
    "lokesh": "KL Rahul",
    "lokesh rahul": "KL Rahul",
    "kannur lokesh rahul": "KL Rahul",

    # ── AB de Villiers ───────────────────────────────────────────────
    "ab de villiers": "AB de Villiers",
    "abd": "AB de Villiers",
    "de villiers": "AB de Villiers",
    "villiers": "AB de Villiers",
    "ab": "AB de Villiers",
    "mr 360": "AB de Villiers",
    "mr. 360": "AB de Villiers",

    # ── CH Gayle ─────────────────────────────────────────────────────
    "gayle": "CH Gayle",
    "chris gayle": "CH Gayle",
    "chris": "CH Gayle",
    "universe boss": "CH Gayle",

    # ── RR Pant ──────────────────────────────────────────────────────
    "pant": "RR Pant",
    "rishabh": "RR Pant",
    "rishabh pant": "RR Pant",

    # ── SA Yadav ─────────────────────────────────────────────────────
    "surya": "SA Yadav",
    "suryakumar": "SA Yadav",
    "suryakumar yadav": "SA Yadav",
    "sky": "SA Yadav",
    "surya kumar yadav": "SA Yadav",

    # ── HH Pandya ────────────────────────────────────────────────────
    "hardik": "HH Pandya",
    "hardik pandya": "HH Pandya",
    "pandya": "HH Pandya",

    # ── RA Jadeja ────────────────────────────────────────────────────
    "jadeja": "RA Jadeja",
    "ravindra jadeja": "RA Jadeja",
    "jaddu": "RA Jadeja",
    "sir jadeja": "RA Jadeja",
    "ravindra": "RA Jadeja",

    # ── YS Chahal ────────────────────────────────────────────────────
    "chahal": "YS Chahal",
    "yuzvendra": "YS Chahal",
    "yuzvendra chahal": "YS Chahal",

    # ── Rashid Khan ──────────────────────────────────────────────────
    "rashid": "Rashid Khan",
    "rashid khan": "Rashid Khan",

    # ── B Kumar ──────────────────────────────────────────────────────
    "bhuvneshwar": "B Kumar",
    "bhuvneshwar kumar": "B Kumar",
    "bhuvi": "B Kumar",

    # ── Mohammed Shami ───────────────────────────────────────────────
    "shami": "Mohammed Shami",
    "mohammed shami": "Mohammed Shami",
    "md shami": "Mohammed Shami",

    # ── Mohammed Siraj ───────────────────────────────────────────────
    "siraj": "Mohammed Siraj",
    "mohammed siraj": "Mohammed Siraj",
    "md siraj": "Mohammed Siraj",

    # ── JC Buttler ───────────────────────────────────────────────────
    "buttler": "JC Buttler",
    "jos buttler": "JC Buttler",
    "jos": "JC Buttler",

    # ── F du Plessis ─────────────────────────────────────────────────
    "faf": "F du Plessis",
    "faf du plessis": "F du Plessis",
    "du plessis": "F du Plessis",
    "plessis": "F du Plessis",

    # ── Shubman Gill ─────────────────────────────────────────────────
    "shubman": "Shubman Gill",
    "shubman gill": "Shubman Gill",
    "gill": "Shubman Gill",

    # ── RD Gaikwad ───────────────────────────────────────────────────
    "gaikwad": "RD Gaikwad",
    "ruturaj": "RD Gaikwad",
    "ruturaj gaikwad": "RD Gaikwad",

    # ── SV Samson ────────────────────────────────────────────────────
    "samson": "SV Samson",
    "sanju": "SV Samson",
    "sanju samson": "SV Samson",

    # ── Ishan Kishan ─────────────────────────────────────────────────
    "ishan": "Ishan Kishan",
    "ishan kishan": "Ishan Kishan",
    "kishan": "Ishan Kishan",

    # ── KA Pollard ───────────────────────────────────────────────────
    "pollard": "KA Pollard",
    "kieron pollard": "KA Pollard",
    "kieron": "KA Pollard",
    "polly": "KA Pollard",

    # ── AD Russell ───────────────────────────────────────────────────
    "russell": "AD Russell",
    "andre russell": "AD Russell",
    "dre russ": "AD Russell",
    "muscle russell": "AD Russell",

    # ── DJ Bravo ─────────────────────────────────────────────────────
    "bravo": "DJ Bravo",
    "dwayne bravo": "DJ Bravo",
    "dwayne": "DJ Bravo",
    "champion": "DJ Bravo",

    # ── SP Narine ────────────────────────────────────────────────────
    "narine": "SP Narine",
    "sunil narine": "SP Narine",
    "sunil": "SP Narine",

    # ── PA Patel ─────────────────────────────────────────────────────
    "parthiv": "PA Patel",
    "parthiv patel": "PA Patel",

    # ── G Gambhir ────────────────────────────────────────────────────
    "gambhir": "G Gambhir",
    "gautam": "G Gambhir",
    "gautam gambhir": "G Gambhir",
    "gauti": "G Gambhir",

    # ── V Sehwag ─────────────────────────────────────────────────────
    "sehwag": "V Sehwag",
    "virender sehwag": "V Sehwag",
    "virender": "V Sehwag",
    "viru": "V Sehwag",
    "nawab of najafgarh": "V Sehwag",

    # ── SR Watson ────────────────────────────────────────────────────
    "watson": "SR Watson",
    "shane watson": "SR Watson",
    "shane": "SR Watson",
    "watto": "SR Watson",

    # ── GJ Maxwell ───────────────────────────────────────────────────
    "maxwell": "GJ Maxwell",
    "glenn maxwell": "GJ Maxwell",
    "glenn": "GJ Maxwell",
    "maxi": "GJ Maxwell",
    "big show": "GJ Maxwell",

    # ── Yuvraj Singh ─────────────────────────────────────────────────
    "yuvraj": "Yuvraj Singh",
    "yuvraj singh": "Yuvraj Singh",
    "yuvi": "Yuvraj Singh",

    # ── SR Tendulkar ─────────────────────────────────────────────────
    "tendulkar": "SR Tendulkar",
    "sachin": "SR Tendulkar",
    "sachin tendulkar": "SR Tendulkar",
    "master blaster": "SR Tendulkar",
    "god of cricket": "SR Tendulkar",

    # ── A Kumble ─────────────────────────────────────────────────────
    "kumble": "A Kumble",
    "anil kumble": "A Kumble",
    "anil": "A Kumble",
    "jumbo": "A Kumble",

    # ── Harbhajan Singh ──────────────────────────────────────────────
    "harbhajan": "Harbhajan Singh",
    "harbhajan singh": "Harbhajan Singh",
    "bhajji": "Harbhajan Singh",
    "turbanator": "Harbhajan Singh",

    # ── Z Khan ───────────────────────────────────────────────────────
    "zaheer": "Z Khan",
    "zaheer khan": "Z Khan",
    "zak": "Z Khan",

    # ── R Ashwin ─────────────────────────────────────────────────────
    "ashwin": "R Ashwin",
    "ravichandran ashwin": "R Ashwin",
    "ravichandran": "R Ashwin",
    "ash": "R Ashwin",

    # ── A Mishra ─────────────────────────────────────────────────────
    "amit mishra": "A Mishra",
    "mishra": "A Mishra",

    # ── PP Shaw ──────────────────────────────────────────────────────
    "prithvi": "PP Shaw",
    "prithvi shaw": "PP Shaw",
    "shaw": "PP Shaw",

    # ── D Padikkal ───────────────────────────────────────────────────
    "padikkal": "D Padikkal",
    "devdutt": "D Padikkal",
    "devdutt padikkal": "D Padikkal",

    # ── KS Williamson ────────────────────────────────────────────────
    "williamson": "KS Williamson",
    "kane": "KS Williamson",
    "kane williamson": "KS Williamson",

    # ── MA Agarwal ───────────────────────────────────────────────────
    "mayank": "MA Agarwal",
    "mayank agarwal": "MA Agarwal",
    "agarwal": "MA Agarwal",

    # ── AM Rahane ────────────────────────────────────────────────────
    "rahane": "AM Rahane",
    "ajinkya": "AM Rahane",
    "ajinkya rahane": "AM Rahane",
    "jinx": "AM Rahane",

    # ── WP Saha ──────────────────────────────────────────────────────
    "saha": "WP Saha",
    "wriddhiman": "WP Saha",
    "wriddhiman saha": "WP Saha",

    # ── N Rana ───────────────────────────────────────────────────────
    "nitish": "N Rana",
    "nitish rana": "N Rana",
    "rana": "N Rana",

    # ── KD Karthik ───────────────────────────────────────────────────
    "dinesh karthik": "KD Karthik",
    "karthik": "KD Karthik",
    "dk": "KD Karthik",
    "dinesh": "KD Karthik",

    # ── AT Rayudu ────────────────────────────────────────────────────
    "rayudu": "AT Rayudu",
    "ambati": "AT Rayudu",
    "ambati rayudu": "AT Rayudu",

    # ── MK Pandey ────────────────────────────────────────────────────
    "manish": "MK Pandey",
    "manish pandey": "MK Pandey",

    # ── Q de Kock ────────────────────────────────────────────────────
    "de kock": "Q de Kock",
    "quinton": "Q de Kock",
    "quinton de kock": "Q de Kock",

    # ── DA Miller ────────────────────────────────────────────────────
    "miller": "DA Miller",
    "david miller": "DA Miller",
    "killer miller": "DA Miller",

    # ── N Pooran ─────────────────────────────────────────────────────
    "pooran": "N Pooran",
    "nicholas pooran": "N Pooran",
    "nicholas": "N Pooran",

    # ── RA Tripathi ──────────────────────────────────────────────────
    "tripathi": "RA Tripathi",
    "rahul tripathi": "RA Tripathi",

    # ── SS Iyer ──────────────────────────────────────────────────────
    "shreyas": "SS Iyer",
    "shreyas iyer": "SS Iyer",
    "iyer": "SS Iyer",

    # ── YBK Jaiswal ──────────────────────────────────────────────────
    "jaiswal": "YBK Jaiswal",
    "yashasvi": "YBK Jaiswal",
    "yashasvi jaiswal": "YBK Jaiswal",

    # ── T Natarajan ──────────────────────────────────────────────────
    "natarajan": "T Natarajan",
    "thangarasu natarajan": "T Natarajan",

    # ── Arshdeep Singh ───────────────────────────────────────────────
    "arshdeep": "Arshdeep Singh",
    "arshdeep singh": "Arshdeep Singh",

    # ── M Pathirana ──────────────────────────────────────────────────
    "pathirana": "M Pathirana",
    "matheesha": "M Pathirana",
    "matheesha pathirana": "M Pathirana",

    # ── Umran Malik ──────────────────────────────────────────────────
    "umran": "Umran Malik",
    "umran malik": "Umran Malik",
    "malik": "Umran Malik",

    # ── Avesh Khan ───────────────────────────────────────────────────
    "avesh": "Avesh Khan",
    "avesh khan": "Avesh Khan",

    # ── T Head ───────────────────────────────────────────────────────
    "travis": "T Head",
    "travis head": "T Head",
    "head": "T Head",

    # ── PBB Rajapaksa ────────────────────────────────────────────────
    "rajapaksa": "PBB Rajapaksa",
    "bhanuka": "PBB Rajapaksa",
    "bhanuka rajapaksa": "PBB Rajapaksa",

    # ── H Klaasen ────────────────────────────────────────────────────
    "klaasen": "H Klaasen",
    "heinrich": "H Klaasen",
    "heinrich klaasen": "H Klaasen",

    # ── Nithish Kumar Reddy (ball-by-ball data spells "Nithish"; feeds often say "Nitish")
    "nitish kumar reddy": "Nithish Kumar Reddy",
    "nitish reddy": "Nithish Kumar Reddy",

    # ── Extra popular players ────────────────────────────────────────

    # KD Jadhav
    "jadhav": "KD Jadhav",
    "kedar": "KD Jadhav",
    "kedar jadhav": "KD Jadhav",

    # PP Chawla
    "piyush": "PP Chawla",
    "piyush chawla": "PP Chawla",
    "chawla": "PP Chawla",

    # RP Singh
    "rp singh": "RP Singh",

    # S Badrinath
    "badrinath": "S Badrinath",

    # M Vijay
    "murali vijay": "M Vijay",
    "vijay": "M Vijay",

    # RV Uthappa
    "uthappa": "RV Uthappa",
    "robin uthappa": "RV Uthappa",
    "robin": "RV Uthappa",

    # KH Pandya (Krunal)
    "krunal": "KH Pandya",
    "krunal pandya": "KH Pandya",

    # SN Thakur
    "shardul": "SN Thakur",
    "shardul thakur": "SN Thakur",
    "thakur": "SN Thakur",
    "lord shardul": "SN Thakur",
    "lord thakur": "SN Thakur",

    # T Boult
    "boult": "T Boult",
    "trent boult": "T Boult",
    "trent": "T Boult",

    # Kuldeep Yadav
    "kuldeep": "Kuldeep Yadav",
    "kuldeep yadav": "Kuldeep Yadav",

    # DJ Hooda
    "hooda": "DJ Hooda",
    "deepak hooda": "DJ Hooda",

    # R Powell
    "powell": "R Powell",
    "rovman powell": "R Powell",

    # TA Boult / K Rabada
    "rabada": "K Rabada",
    "kagiso": "K Rabada",
    "kagiso rabada": "K Rabada",

    # JR Hazlewood
    "hazlewood": "JR Hazlewood",
    "josh hazlewood": "JR Hazlewood",

    # PJ Cummins
    "cummins": "PJ Cummins",
    "pat cummins": "PJ Cummins",
    "pat": "PJ Cummins",

    # MA Starc
    "starc": "MA Starc",
    "mitchell starc": "MA Starc",

    # JD Unadkat
    "unadkat": "JD Unadkat",
    "jaydev": "JD Unadkat",
    "jaydev unadkat": "JD Unadkat",

    # Harshal Patel
    "harshal": "HV Patel",
    "harshal patel": "HV Patel",

    # Washington Sundar
    "washington": "Washington Sundar",
    "washington sundar": "Washington Sundar",
    "sundar": "Washington Sundar",

    # Axar Patel
    "axar": "AR Patel",
    "axar patel": "AR Patel",

    # Deepak Chahar
    "deepak chahar": "DL Chahar",
    "chahar": "DL Chahar",

    # Rahul Chahar
    "rahul chahar": "RD Chahar",

    # Rinku Singh
    "rinku": "Rinku Singh",
    "rinku singh": "Rinku Singh",

    # Tilak Varma
    "tilak": "Tilak Varma",
    "tilak varma": "Tilak Varma",
    "varma": "Tilak Varma",

    # Venkatesh Iyer
    "venkatesh": "Venkatesh Iyer",
    "venkatesh iyer": "Venkatesh Iyer",

    # Mukesh Choudhary
    "mukesh": "Mukesh Choudhary",
    "mukesh choudhary": "Mukesh Choudhary",

    # Tushar Deshpande
    "tushar": "TU Deshpande",
    "tushar deshpande": "TU Deshpande",
    "deshpande": "TU Deshpande",

    # M Shami -> already covered above

    # Jofra Archer
    "archer": "JC Archer",
    "jofra": "JC Archer",
    "jofra archer": "JC Archer",

    # Ben Stokes
    "stokes": "BA Stokes",
    "ben stokes": "BA Stokes",

    # MS Dhoni related already covered

    # Ravindra Jadeja already covered

    # Faf du Plessis already covered

    # Moeen Ali
    "moeen": "MM Ali",
    "moeen ali": "MM Ali",

    # Devon Conway
    "conway": "DP Conway",
    "devon conway": "DP Conway",
    "devon": "DP Conway",

    # Sam Curran
    "curran": "SM Curran",
    "sam curran": "SM Curran",

    # Alzarri Joseph
    "alzarri": "AS Joseph",
    "alzarri joseph": "AS Joseph",
    "joseph": "AS Joseph",

    # Liam Livingstone
    "livingstone": "LS Livingstone",
    "liam livingstone": "LS Livingstone",

    # Marcus Stoinis
    "stoinis": "MP Stoinis",
    "marcus stoinis": "MP Stoinis",

    # Shimron Hetmyer
    "hetmyer": "SO Hetmyer",
    "shimron hetmyer": "SO Hetmyer",

    # Tewatia
    "tewatia": "R Tewatia",
    "rahul tewatia": "R Tewatia",

    # R Parag
    "parag": "R Parag",
    "riyan parag": "R Parag",
    "riyan": "R Parag",

    # Abhishek Sharma
    "abhishek": "Abhishek Sharma",
    "abhishek sharma": "Abhishek Sharma",

    # M Theekshana
    "theekshana": "M Theekshana",
    "maheesh theekshana": "M Theekshana",

    # Anrich Nortje
    "nortje": "A Nortje",
    "anrich nortje": "A Nortje",

    # Lungi Ngidi
    "ngidi": "L Ngidi",
    "lungi ngidi": "L Ngidi",

    # Dwaine Pretorius
    "pretorius": "D Pretorius",

    # Ravi Bishnoi
    "bishnoi": "Ravi Bishnoi",
    "ravi bishnoi": "Ravi Bishnoi",

    # Rahmanullah Gurbaz
    "gurbaz": "Rahmanullah Gurbaz",
    "rahmanullah": "Rahmanullah Gurbaz",

    # Phil Salt
    "salt": "PD Salt",
    "phil salt": "PD Salt",

    # Cameron Green
    "cameron green": "C Green",

    # PVD Chameera
    "chameera": "PVD Chameera",
    "dushmantha chameera": "PVD Chameera",

    # Imran Tahir
    "tahir": "Imran Tahir",
    "imran tahir": "Imran Tahir",

    # Lasith Malinga
    "malinga": "SL Malinga",
    "lasith malinga": "SL Malinga",
    "lasith": "SL Malinga",
    "slinga": "SL Malinga",

    # Dwayne Smith
    "dwayne smith": "DR Smith",

    # M Morkel
    "morkel": "M Morkel",
    "morne morkel": "M Morkel",

    # Dale Steyn
    "steyn": "DW Steyn",
    "dale steyn": "DW Steyn",

    # Brett Lee
    "brett lee": "B Lee",

    # Jacques Kallis
    "kallis": "JH Kallis",
    "jacques kallis": "JH Kallis",

    # Michael Hussey
    "hussey": "MEK Hussey",
    "michael hussey": "MEK Hussey",
    "mr cricket": "MEK Hussey",

    # Adam Gilchrist
    "gilchrist": "AC Gilchrist",
    "adam gilchrist": "AC Gilchrist",
    "gilly": "AC Gilchrist",

    # R Dravid
    "dravid": "R Dravid",
    "rahul dravid": "R Dravid",
    "the wall": "R Dravid",

    # Sourav Ganguly
    "ganguly": "SC Ganguly",
    "sourav ganguly": "SC Ganguly",
    "dada": "SC Ganguly",

    # JP Duminy
    "duminy": "JP Duminy",

    # M Marsh
    "marsh": "MR Marsh",
    "mitchell marsh": "MR Marsh",

    # Heinrich Klaasen already covered above

    # Travis Head already covered above

    # Prabhsimran Singh
    "prabhsimran": "Prabhsimran Singh",

    # Donaldson
    # Various other aliases can be added as needed
}


def resolve_aliases(search_term: str) -> list[str]:
    """
    Given a search term, return a list of matching database player names
    from the alias dictionary (case-insensitive, deduplicated).
    """
    term = search_term.strip().lower()
    if not term:
        return []

    matched: list[str] = []
    seen: set[str] = set()

    # 1. Exact alias match
    if term in PLAYER_ALIASES:
        name = PLAYER_ALIASES[term]
        if name not in seen:
            matched.append(name)
            seen.add(name)

    # 2. Partial alias match — only if alias starts with the search term
    #    or the search term starts with the alias (but alias must be >= 3 chars to avoid false positives)
    for alias, name in PLAYER_ALIASES.items():
        if name in seen:
            continue
        if alias.startswith(term) or (len(alias) >= 3 and term.startswith(alias)):
            matched.append(name)
            seen.add(name)

    return matched
