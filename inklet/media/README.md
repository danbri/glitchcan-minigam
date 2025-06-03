# Media files 


Files for sample episodes.

## Tooling notes

Packages (linux / WSL2)

 * sudo apt update && sudo apt install imagemagick
 * sudo apt install libimage-exiftool-perl


Image summary:

 * identify *.jpg
 * file *
 * identify -format "%f: %wx%h %b %m\n" *.jpg

What we tried so far:

 * convert glitchcan-grey-portrait-orig.png -quality 25 -strip glitchcan-grey-portrait-web.jpg
 * convert glitchcan-grey-portrait-orig.png -resize 512x768 -quality 30 glitchcan-grey-portrait-small.jpg
 * convert glitchcan-grey-portrait-orig.png -resize 1024x1536 -quality 30 glitchcan-grey-portrait-large.jpg


# Fink / Ink spec issues

How should multiple variants be represented in Ink?

For example 
```
IMAGE: glitchcan-grey-portrait
  variants: {
    "small": { "src": "glitchcan-grey-portrait-small.jpg", "size": "512x768", "bytes": 40601 },
    "medium": { "src": "glitchcan-grey-portrait-web.jpg", "size": "1024x1536", "bytes": 238974 },
    "large": { "src": "glitchcan-grey-portrait-large.jpg", "size": "1024x1536", "bytes": 281400 }
  }
  breakpoints: { "mobile": "small", "tablet": "medium", "desktop": "medium" }
  aspect: "2:3"
```

Fixed filenames? Use extension functions? Ink tags?

### Tags syntax example

```
The ancient portrait looms before you, its glitchy surface shifting in the dim light. #image:glitchcan-grey-portrait #sizes:small=512x768,medium=1024x1536,large=1024x1536 #breakpoints:mobile=small,tablet=medium,desktop=medium #aspect:2:3 #loading:eager

* [Examine the portrait more closely] 
  You step forward, studying the corrupted pixels. #image:glitchcan-grey-portrait-detail #sizes:thumbnail=256x384,full=2048x3072 #overlay:true
```

### Extension functions (flexible, uglier)

```
EXTERNAL displayImage(imageName, config)
EXTERNAL preloadMedia(mediaList)

The portrait catches your eye.
~ displayImage("glitchcan-grey-portrait", "responsive:true,sizes:small|medium|large,aspect:2-3,priority:high")

* [Study the image]
  ~ displayImage("glitchcan-grey-portrait", "zoom:true,overlay:true")
```

Still note clear exactly re filenames. Work in progress.
