# Shane Manor Mystery - Image Assets

## Overview
Victorian Gothic mystery illustration set for the Shane Manor FINK story. All images are pencil sketch style in monochrome, perfect for the atmospheric detective narrative.

## Image Catalog & Proposed Mappings

### Exterior Views
| Original Filename | Proposed Name | Description | Story Knots | Size | Priority |
|-------------------|---------------|-------------|-------------|------|----------|
| `21F447A7-BB91-4304-A481-8DF3B661702A.png` | `manor_exterior_stormy.png` | Gothic manor in stormy weather, dramatic mood | `start`, `crime_scene` | 1024x1536, 3.03MB | HIGH |
| `94A74546-DC32-4346-B5D0-AA24A18C53F5.png` | `manor_exterior_detailed.png` | Detailed front view of Gothic manor | `meet_butler`, `investigation_choice` | 1024x1024, 2.99MB | HIGH |
| `B90A6C87-750B-428A-8F06-693EA38AA6FD.png` | `manor_exterior_path.png` | Manor with winding path approach | `start` (alternate) | 1024x1024, 2.84MB | MEDIUM |
| `D69B7A5A-0CBE-471D-AB55-CB8373ADFA4A.png` | `manor_with_taxi.png` | Manor with period taxi (perfect for opening) | `start` | 1024x1024, 2.13MB | HIGH |
| `9430F021-24C4-47E4-A7D6-0CF6CD0B96A4.png` | `manor_distant_view.png` | Distant view through trees | Background/atmosphere | 1536x1024, 4.00MB | LOW |
| `F4A1A55A-8D23-4797-9B1A-73F53A6B20D6.png` | `small_house_path.png` | Smaller building, may be servants' quarters | `interview_mary` | 1024x1024, 2.94MB | MEDIUM |

### Interior Rooms - Main Floors
| Original Filename | Proposed Name | Description | Story Knots | Size | Priority |
|-------------------|---------------|-------------|-------------|------|----------|
| `E58AAA49-D6E0-4322-B625-4743D5746685.png` | `study_crime_scene.png` | Study with desk, bookshelf, fireplace | `crime_scene`, `examine_safe`, `examine_chess` | 1024x1536, 4.23MB | HIGH |
| `9F5B8622-4E22-4548-83BA-50B74F7E9942.png` | `entrance_hall_stairs.png` | Grand entrance with staircase | `meet_butler` | 1024x1536, 4.37MB | HIGH |
| `ABBE89E4-5722-406D-A211-CEEF8BC8BA10.png` | `entrance_hall_doors.png` | Entrance hall with double doors | `meet_butler` (alternate) | 1024x1024, 2.91MB | MEDIUM |
| `14CE8FF2-B627-4A2E-AFCE-978AEABFC296.png` | `dining_room_formal.png` | Formal dining room with chandelier | `gather_household` | 1024x1024, 3.15MB | MEDIUM |
| `90994B05-1FA7-4202-917B-6CD3546CB285.png` | `morning_room_table.png` | Morning room with smaller table | `interview_charles`, `deduction` | 1024x1536, 4.58MB | HIGH |

### Character Scenes
| Original Filename | Proposed Name | Description | Story Knots | Size | Priority |
|-------------------|---------------|-------------|-------------|------|----------|
| `D9E7B2F4-41F6-4902-9813-586CC1BC8DA5.png` | `butler_questioning.png` | Butler being questioned (4 figures) | `meet_butler`, `interview_mary` | 1024x1024, 3.13MB | HIGH |
| `F9F455DE-3AA4-4861-A0F3-1337F617C92C.png` | `household_meeting.png` | Inspector interviewing household | `gather_household`, `accuse_charles` | 1024x1536, 4.46MB | HIGH |

### Service Areas
| Original Filename | Proposed Name | Description | Story Knots | Size | Priority |
|-------------------|---------------|-------------|-------------|------|----------|
| `98FFC930-2807-4E72-B2C9-7711DF8F323F.png` | `servants_hall.png` | Kitchen/servants' area | `interview_mary` | 1024x1024, 3.12MB | MEDIUM |
| `49B08769-1F73-40FF-BD0A-446E07A4F8E6.png` | `washroom.png` | Victorian bathroom | Background/atmosphere | 1024x1536, 4.01MB | LOW |

### Bedrooms
| Original Filename | Proposed Name | Description | Story Knots | Size | Priority |
|-------------------|---------------|-------------|-------------|------|----------|
| `32166BBA-587D-4A47-BE67-92905C0F2B17.png` | `guest_bedroom.png` | Simple bedroom | Character backgrounds | 1024x1024, 2.97MB | LOW |
| `FEEFDE3D-9C2A-4E02-BD62-338BC011DB74.png` | `master_bedroom.png` | Larger bedroom with dresser | Character backgrounds | 1536x1024, 4.37MB | LOW |

### Special Images
| Original Filename | Proposed Name | Description | Story Knots | Size | Priority |
|-------------------|---------------|-------------|-------------|------|----------|
| `59553BC3-A7DC-49A9-8F37-C2A37EBFF318.png` | `manor_floor_plan.png` | Architectural floor plan of manor | `examine_barricade`, Investigation reference | 1024x1024, 2.61MB | HIGH |
| `42788AD1-6EFB-4872-8094-F0BF9DBE30DE.png` | `study_library_combo.png` | Study/library composite view | `crime_scene` (detailed view) | 1024x1536, 4.57MB | MEDIUM |
| `E0021361-6D6D-42B5-8EF8-B02BF9335DEE.png` | `room_grid_overview.png` | Multiple room views in grid | Reference/debug view | 1024x1536, 4.42MB | LOW |

## Story Knot Mapping Recommendations

### High Priority Knots (Need Images)
1. **`start`** → `manor_with_taxi.png` (shows Inspector arriving)
2. **`meet_butler`** → `entrance_hall_stairs.png` (grand entrance)
3. **`crime_scene`** → `study_crime_scene.png` (the murder scene)
4. **`examine_safe`** → `study_crime_scene.png` (same room, different focus)
5. **`interview_mary`** → `servants_hall.png` (where Mary works)
6. **`gather_household`** → `household_meeting.png` (group interrogation)
7. **`accuse_charles`** → `household_meeting.png` (dramatic revelation)

### Medium Priority Knots
1. **`investigation_choice`** → `manor_exterior_detailed.png`
2. **`deduction`** → `morning_room_table.png`
3. **`interview_charles`** → `morning_room_table.png`

## Optimization Recommendations

### Current Issues
- **File sizes too large**: 2.1MB - 4.6MB per image
- **Dimensions inconsistent**: Mix of 1024x1024, 1024x1536, 1536x1024
- **No web-optimized versions**

### Optimization Strategy

#### 1. Create Multiple Sizes
```bash
# High priority images - 3 sizes each
# Desktop: 800x800 (square) or 800x1200 (portrait) 
# Tablet: 600x600 or 600x900
# Mobile: 400x400 or 400x600

# Medium priority - 2 sizes
# Desktop: 800px max dimension
# Mobile: 400px max dimension

# Low priority - 1 size
# Desktop only: 600px max dimension
```

#### 2. Target File Sizes
- **Desktop**: <200KB per image
- **Tablet**: <100KB per image  
- **Mobile**: <50KB per image

#### 3. Format Strategy
- **PNG**: Keep for high-detail images (crime scene, floor plan)
- **WebP**: Convert pencil sketches (good compression for line art)
- **JPEG**: Fallback for older browsers

### Implementation Commands
```bash
# Create optimized versions (example)
convert manor_with_taxi.png -resize 800x800 -quality 85 manor_with_taxi_desktop.jpg
convert manor_with_taxi.png -resize 600x600 -quality 80 manor_with_taxi_tablet.jpg  
convert manor_with_taxi.png -resize 400x400 -quality 75 manor_with_taxi_mobile.jpg

# WebP versions
cwebp -q 80 manor_with_taxi_desktop.jpg -o manor_with_taxi_desktop.webp
```

## Integration Notes

### FINK Story Integration
Add to shane-manor.fink.js:
```ink
=== start ===
# IMAGE: shane/manor_with_taxi.png
Inspector Shane André-Louis steps out of the black taxi...

=== crime_scene ===  
# IMAGE: shane/study_crime_scene.png
The oak-paneled study reeks of tobacco...
```

### Responsive Image Loading
Consider implementing responsive image loading in FINK player:
- Detect device/screen size
- Load appropriate image size
- Progressive loading (low-res → high-res)

## File Renaming Script
```bash
#!/bin/bash
# Rename files to meaningful names
mv 14CE8FF2-B627-4A2E-AFCE-978AEABFC296.png dining_room_formal.png
mv 21F447A7-BB91-4304-A481-8DF3B661702A.png manor_exterior_stormy.png
mv 32166BBA-587D-4A47-BE67-92905C0F2B17.png guest_bedroom.png
mv 42788AD1-6EFB-4872-8094-F0BF9DBE30DE.png study_library_combo.png
mv 49B08769-1F73-40FF-BD0A-446E07A4F8E6.png washroom.png
mv 59553BC3-A7DC-49A9-8F37-C2A37EBFF318.png manor_floor_plan.png
mv 90994B05-1FA7-4202-917B-6CD3546CB285.png morning_room_table.png
mv 9430F021-24C4-47E4-A7D6-0CF6CD0B96A4.png manor_distant_view.png
mv 94A74546-DC32-4346-B5D0-AA24A18C53F5.png manor_exterior_detailed.png
mv 98FFC930-2807-4E72-B2C9-7711DF8F323F.png servants_hall.png
mv 9F5B8622-4E22-4548-83BA-50B74F7E9942.png entrance_hall_stairs.png
mv ABBE89E4-5722-406D-A211-CEEF8BC8BA10.png entrance_hall_doors.png
mv B90A6C87-750B-428A-8F06-693EA38AA6FD.png manor_exterior_path.png
mv D69B7A5A-0CBE-471D-AB55-CB8373ADFA4A.png manor_with_taxi.png
mv D9E7B2F4-41F6-4902-9813-586CC1BC8DA5.png butler_questioning.png
mv E0021361-6D6D-42B5-8EF8-B02BF9335DEE.png room_grid_overview.png
mv E58AAA49-D6E0-4322-B625-4743D5746685.png study_crime_scene.png
mv F4A1A55A-8D23-4797-9B1A-73F53A6B20D6.png small_house_path.png
mv F9F455DE-3AA4-4861-A0F3-1337F617C92C.png household_meeting.png
mv FEEFDE3D-9C2A-4E02-BD62-338BC011DB74.png master_bedroom.png
```

## Next Steps
1. Run renaming script
2. Create optimized versions for high-priority images
3. Update shane-manor.fink.js with IMAGE tags
4. Test loading performance on mobile
5. Implement responsive image loading if needed