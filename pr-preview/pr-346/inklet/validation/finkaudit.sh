#!/bin/bash

find . -name '*fink.js' -exec awk '
  BEGINFILE { first=""; ooo="" }              # reset per file

  # remember the first non-blank line
  first=="" && $0 !~ /^[[:space:]]*$/ { first=$0 }

  # remember the first line that shows the magic token
  ooo=="" && /oooOO`/ { ooo=$0 }

  ENDFILE {
    printf "%s\n  first: %s\n  ooo:   %s\n\n", FILENAME, first, ooo
  }
' {} +
