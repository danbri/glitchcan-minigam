# Monochrome WatchMaker - Pascal Source

This directory contains a verbatim copy of the original Pascal source code for
Richard Dawkins' "Monochrome WatchMaker" (a.k.a. The Blind Watchmaker biomorph
program), preserved here for historical reference.

## Source

Files were copied (not linked) from the public WatchmakerSuite archive:

  https://github.com/Aronnax9000/WatchmakerSuite
  Path: docs/Dawkins/Monochrome WatchMaker/

Fetched on 2026-05-06.

## Original Authorship

The Pascal source code was written by Richard Dawkins (and collaborators) in the
mid-1980s for classic Mac OS, accompanying the book *The Blind Watchmaker*
(1986). All rights remain with the original author(s).

## File Notes

- Files without extensions (`Album`, `Biomorphs`, `Globals`, `Initialize`,
  `Main`, `Pedigree`, `User Interface`, etc.) are classic Mac Pascal **unit**
  source files. They are plain ASCII text with classic-Mac CR (`\r`) line
  terminators.
- Files with `.p` extensions (`Blind_Watchmaker.p`, `ErrorUnit.p`,
  `StandardGetFolder.p`) are Pascal program / unit source.
- A few entries (`Stunted`, `Chinese character`, `Handkerchief with bows`,
  `BWTP`, `BW.rsrc`) are binary Mac resource forks / saved-biomorph data files
  with no useful textual content on this platform; they are kept as-is for
  archival completeness.

## Status in This Project

These files are **reference material only**. The runtime in `biomorphs/`
(`biomorph.js`) is a behaviour-faithful JavaScript port of the `Develop`,
`Tree` and `PlugIn` procedures from the `Biomorphs` unit, preserving the
v1.1 genome structure and rendering semantics. The Pascal source is not
consumed by the runtime; it is kept here for archival/reference purposes only.
