from backend.database import query, normalize_venue
import os

def find_missing_venues():
    existing = os.listdir('backend/venue_images')
    venues_rows = query('SELECT DISTINCT venue FROM matches')
    missing = []
    
    for row in venues_rows:
        v = row['venue']
        canonical = normalize_venue(v)
        clean_name = canonical.replace(', ', '_').replace(' ', '_')
        simple_name = canonical.split(',')[0].replace(' ', '_')
        
        found = False
        for name in [clean_name, simple_name]:
            for ext in ['.jpg', '.jpeg', '.png', '.webp']:
                if name + ext in existing:
                    found = True
                    break
            if found: break
            
        if not found:
            missing.append(canonical)
            
    return sorted(list(set(missing)))

if __name__ == "__main__":
    missing = find_missing_venues()
    print(f"Total missing: {len(missing)}")
    print("Top 10 missing:")
    for v in missing[:10]:
        print(v)
