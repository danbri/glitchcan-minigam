#!/bin/bash
# Optimize Shane Manor images for web performance

cd "$(dirname "$0")"

echo "🖼️ Starting Shane Manor image optimization..."

# Create directories for optimized versions
mkdir -p desktop tablet mobile

# High priority images - create all 3 sizes
HIGH_PRIORITY=(
    "manor_with_taxi.png"
    "study_crime_scene.png" 
    "entrance_hall_stairs.png"
    "household_meeting.png"
    "manor_floor_plan.png"
    "manor_exterior_detailed.png"
    "morning_room_table.png"
    "butler_questioning.png"
)

# Medium priority images - create 2 sizes
MEDIUM_PRIORITY=(
    "manor_exterior_stormy.png"
    "dining_room_formal.png"
    "entrance_hall_doors.png"
    "servants_hall.png"
    "study_library_combo.png"
    "small_house_path.png"
)

# Low priority images - create 1 size only
LOW_PRIORITY=(
    "manor_exterior_path.png"
    "manor_distant_view.png"
    "guest_bedroom.png"
    "master_bedroom.png"
    "washroom.png"
    "room_grid_overview.png"
)

# Function to optimize image
optimize_image() {
    local input="$1"
    local output="$2"
    local size="$3"
    local quality="$4"
    
    if [ -f "$input" ]; then
        convert "$input" -resize "$size" -quality "$quality" -strip "$output"
        echo "  ✅ Created: $output ($(du -h "$output" | cut -f1))"
    else
        echo "  ❌ Missing: $input"
    fi
}

echo "📱 Processing HIGH PRIORITY images (3 sizes each)..."
for img in "${HIGH_PRIORITY[@]}"; do
    echo "Processing: $img"
    # Desktop (800px max, 85% quality)
    optimize_image "$img" "desktop/${img%.png}_desktop.jpg" "800x800>" "85"
    # Tablet (600px max, 80% quality)  
    optimize_image "$img" "tablet/${img%.png}_tablet.jpg" "600x600>" "80"
    # Mobile (400px max, 75% quality)
    optimize_image "$img" "mobile/${img%.png}_mobile.jpg" "400x400>" "75"
done

echo "💻 Processing MEDIUM PRIORITY images (2 sizes each)..."
for img in "${MEDIUM_PRIORITY[@]}"; do
    echo "Processing: $img"
    # Desktop (800px max, 85% quality)
    optimize_image "$img" "desktop/${img%.png}_desktop.jpg" "800x800>" "85"
    # Mobile (400px max, 75% quality)
    optimize_image "$img" "mobile/${img%.png}_mobile.jpg" "400x400>" "75"
done

echo "🖥️ Processing LOW PRIORITY images (1 size each)..."
for img in "${LOW_PRIORITY[@]}"; do
    echo "Processing: $img"
    # Desktop only (600px max, 80% quality)
    optimize_image "$img" "desktop/${img%.png}_desktop.jpg" "600x600>" "80"
done

echo ""
echo "📊 OPTIMIZATION SUMMARY:"
echo "================================"

# Count files and sizes
desktop_count=$(find desktop -name "*.jpg" | wc -l)
tablet_count=$(find tablet -name "*.jpg" | wc -l)
mobile_count=$(find mobile -name "*.jpg" | wc -l)

desktop_size=$(du -sh desktop 2>/dev/null | cut -f1 || echo "0")
tablet_size=$(du -sh tablet 2>/dev/null | cut -f1 || echo "0")
mobile_size=$(du -sh mobile 2>/dev/null | cut -f1 || echo "0")

echo "📁 Desktop: $desktop_count images ($desktop_size total)"
echo "📱 Tablet:  $tablet_count images ($tablet_size total)"
echo "📱 Mobile:  $mobile_count images ($mobile_size total)"

echo ""
echo "🎯 ORIGINAL vs OPTIMIZED:"
original_size=$(du -sh *.png 2>/dev/null | awk '{total += $1} END {print total "MB"}' || echo "0MB")
optimized_size=$(du -sh desktop tablet mobile 2>/dev/null | awk '{total += $1} END {print total}' || echo "0")
echo "📈 Original: ~65MB (20 PNG files)"
echo "📉 Optimized: $optimized_size (across all versions)"

echo ""
echo "✅ Optimization complete!"
echo "🚀 Images ready for web deployment"