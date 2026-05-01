import os
import shutil

# Mapping of my generated image names to the canonical venue names (slugified)
# Canonical names from database.py:
# "Arun Jaitley Stadium, Delhi"
# "MA Chidambaram Stadium, Chennai"
# "Narendra Modi Stadium, Ahmedabad"
# "Rajiv Gandhi International Stadium, Hyderabad"
# "Sawai Mansingh Stadium, Jaipur"
# "Ekana Cricket Stadium, Lucknow"
# "HPCA Stadium, Dharamsala"

mapping = {
    "arun_jaitley_stadium_delhi": "Arun_Jaitley_Stadium_Delhi.png",
    "ma_chidambaram_stadium_chennai": "MA_Chidambaram_Stadium_Chennai.png",
    "narendra_modi_stadium_ahmedabad": "Narendra_Modi_Stadium_Ahmedabad.png",
    "rajiv_gandhi_stadium_hyderabad": "Rajiv_Gandhi_International_Stadium_Hyderabad.png",
    "sawai_mansingh_stadium_jaipur": "Sawai_Mansingh_Stadium_Jaipur.png",
    "hpca_stadium_dharamsala": "HPCA_Stadium_Dharamsala.png",
    "ekana_stadium_lucknow": "Ekana_Cricket_Stadium_Lucknow.png"
}

# The brain directory where images are saved
brain_dir = r"C:\Users\radha\.gemini\antigravity\brain\59564179-6948-4007-829a-2db8a1d3923c"
# The destination directory
dest_dir = r"c:\IPL\ipl-analytics_new\backend\venue_images"

if not os.path.exists(dest_dir):
    os.makedirs(dest_dir)

files = os.listdir(brain_dir)
for key, target_name in mapping.items():
    # Find the latest file starting with the key
    matching_files = [f for f in files if f.startswith(key) and f.endswith(".png")]
    if matching_files:
        # Sort by timestamp (which is part of the name) or just take the last one
        matching_files.sort()
        latest_file = matching_files[-1]
        src_path = os.path.join(brain_dir, latest_file)
        dest_path = os.path.join(dest_dir, target_name)
        print(f"Copying {latest_file} to {target_name}")
        shutil.copy2(src_path, dest_path)
    else:
        print(f"No match for {key}")
