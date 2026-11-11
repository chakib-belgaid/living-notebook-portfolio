#!/usr/bin/env bash
# Makes the served Newsreader files (public/fonts) from the upstream ones
# (fonts-src), keeping only the part of each variable axis the pages ask for.
# Both upstream files are already Latin-only; their size is in the axes
# (weight 200–800, optical size 6–72), so that is what is trimmed:
#
#   upright  weight 400–800, every optical size
#            (the pages use 400–600; nothing lighter than 400)
#   italic   weight 400 only, optical size 6–18
#            (annotations and notes, 13–16px)
#
# Each cut falls on one of the design's own masters, so what is left is
# copied, not re-interpolated: the pages render pixel for pixel as with the
# upstream files. Outside the ranges the browser clamps: an italic above 18px
# is drawn with the 18px cut, a bold italic is synthesised. If a page starts
# asking for either, widen the range here and in src/fonts.css, and rerun.
# tests/fonts.test.mjs fails when the pages and these ranges disagree.
#
# scripts/build-share-cards.mjs sets large italics, so it reads fonts-src.
#
# Needs uv (https://docs.astral.sh/uv/). Run from the repository root:
#   scripts/trim-fonts.sh
set -euo pipefail
cd "$(dirname "$0")/.."

instancer() { uvx --quiet --from 'fonttools[woff]==4.68.0' fonttools varLib.instancer "$@"; }

instancer fonts-src/newsreader-normal.woff2 wght=400:800 -o public/fonts/newsreader-normal.woff2
instancer fonts-src/newsreader-italic.woff2 wght=400 opsz=6:18 -o public/fonts/newsreader-italic.woff2

wc -c fonts-src/newsreader-*.woff2 public/fonts/newsreader-*.woff2
