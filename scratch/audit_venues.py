
import duckdb
import os

def get_venues():
    conn = duckdb.connect('ipl.duckdb')
    # Use the same normalization logic as the backend
    query = """
    SELECT DISTINCT 
        CASE 
            WHEN venue = 'Feroz Shah Kotla' THEN 'Arun Jaitley Stadium, Delhi'
            WHEN venue = 'Arun Jaitley Stadium' THEN 'Arun Jaitley Stadium, Delhi'
            WHEN venue = 'Arun Jaitley Stadium, Delhi' THEN 'Arun Jaitley Stadium, Delhi'
            WHEN venue = 'M Chinnaswamy Stadium' THEN 'M Chinnaswamy Stadium, Bengaluru'
            WHEN venue = 'M.Chinnaswamy Stadium' THEN 'M Chinnaswamy Stadium, Bengaluru'
            WHEN venue = 'M Chinnaswamy Stadium, Bengaluru' THEN 'M Chinnaswamy Stadium, Bengaluru'
            WHEN venue = 'Sardar Patel Stadium, Motera' THEN 'Narendra Modi Stadium, Ahmedabad'
            WHEN venue = 'Narendra Modi Stadium, Ahmedabad' THEN 'Narendra Modi Stadium, Ahmedabad'
            WHEN venue = 'Subrata Roy Sahara Stadium' THEN 'Maharashtra Cricket Association Stadium, Pune'
            WHEN venue = 'Maharashtra Cricket Association Stadium' THEN 'Maharashtra Cricket Association Stadium, Pune'
            WHEN venue = 'Maharashtra Cricket Association Stadium, Pune' THEN 'Maharashtra Cricket Association Stadium, Pune'
            WHEN venue = 'MA Chidambaram Stadium' THEN 'MA Chidambaram Stadium, Chennai'
            WHEN venue = 'MA Chidambaram Stadium, Chepauk' THEN 'MA Chidambaram Stadium, Chennai'
            WHEN venue = 'MA Chidambaram Stadium, Chepauk, Chennai' THEN 'MA Chidambaram Stadium, Chennai'
            WHEN venue = 'Punjab Cricket Association IS Bindra Stadium' THEN 'IS Bindra Stadium, Mohali'
            WHEN venue = 'Punjab Cricket Association IS Bindra Stadium, Mohali' THEN 'IS Bindra Stadium, Mohali'
            WHEN venue = 'Punjab Cricket Association IS Bindra Stadium, Mohali, Chandigarh' THEN 'IS Bindra Stadium, Mohali'
            WHEN venue = 'Punjab Cricket Association Stadium, Mohali' THEN 'IS Bindra Stadium, Mohali'
            WHEN venue = 'Rajiv Gandhi International Stadium' THEN 'Rajiv Gandhi International Stadium, Hyderabad'
            WHEN venue = 'Rajiv Gandhi International Stadium, Uppal' THEN 'Rajiv Gandhi International Stadium, Hyderabad'
            WHEN venue = 'Rajiv Gandhi International Stadium, Uppal, Hyderabad' THEN 'Rajiv Gandhi International Stadium, Hyderabad'
            WHEN venue = 'Wankhede Stadium' THEN 'Wankhede Stadium, Mumbai'
            WHEN venue = 'Wankhede Stadium, Mumbai' THEN 'Wankhede Stadium, Mumbai'
            WHEN venue = 'Eden Gardens' THEN 'Eden Gardens, Kolkata'
            WHEN venue = 'Eden Gardens, Kolkata' THEN 'Eden Gardens, Kolkata'
            WHEN venue = 'Sawai Mansingh Stadium' THEN 'Sawai Mansingh Stadium, Jaipur'
            WHEN venue = 'Sawai Mansingh Stadium, Jaipur' THEN 'Sawai Mansingh Stadium, Jaipur'
            WHEN venue = 'Dr DY Patil Sports Academy' THEN 'Dr DY Patil Sports Academy, Mumbai'
            WHEN venue = 'Dr DY Patil Sports Academy, Mumbai' THEN 'Dr DY Patil Sports Academy, Mumbai'
            WHEN venue = 'Brabourne Stadium' THEN 'Brabourne Stadium, Mumbai'
            WHEN venue = 'Brabourne Stadium, Mumbai' THEN 'Brabourne Stadium, Mumbai'
            WHEN venue = 'Sheikh Zayed Stadium' THEN 'Sheikh Zayed Stadium, Abu Dhabi'
            WHEN venue = 'Zayed Cricket Stadium, Abu Dhabi' THEN 'Sheikh Zayed Stadium, Abu Dhabi'
            WHEN venue = 'Himachal Pradesh Cricket Association Stadium' THEN 'HPCA Stadium, Dharamsala'
            WHEN venue = 'Himachal Pradesh Cricket Association Stadium, Dharamsala' THEN 'HPCA Stadium, Dharamsala'
            WHEN venue = 'Dr. Y.S. Rajasekhara Reddy ACA-VDCA Cricket Stadium' THEN 'ACA-VDCA Stadium, Visakhapatnam'
            WHEN venue = 'Dr. Y.S. Rajasekhara Reddy ACA-VDCA Cricket Stadium, Visakhapatnam' THEN 'ACA-VDCA Stadium, Visakhapatnam'
            WHEN venue = 'Bharat Ratna Shri Atal Bihari Vajpayee Ekana Cricket Stadium, Lucknow' THEN 'Ekana Cricket Stadium, Lucknow'
            WHEN venue = 'Maharaja Yadavindra Singh International Cricket Stadium, Mullanpur' THEN 'MYSI Cricket Stadium, Mullanpur'
            WHEN venue = 'Maharaja Yadavindra Singh International Cricket Stadium, New Chandigarh' THEN 'MYSI Cricket Stadium, Mullanpur'
            ELSE venue 
        END as norm_venue 
    FROM matches
    """
    venues = conn.execute(query).fetchall()
    return [v[0] for v in venues]

if __name__ == '__main__':
    v_list = get_venues()
    print("Unique Normalized Venues:")
    for v in sorted(v_list):
        print(f"- {v}")
    
    img_dir = 'backend/venue_images'
    if os.path.exists(img_dir):
        files = os.listdir(img_dir)
        print("\nExisting Images:")
        for f in sorted(files):
            print(f"- {f}")
