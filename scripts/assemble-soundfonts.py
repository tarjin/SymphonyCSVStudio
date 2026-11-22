#!/usr/bin/env python3
"""Rehydrate the six curated SoundFonts for the Pages deployment."""
import argparse
import pathlib
import shutil
import sys

ASSETS = [
    ("track-01.sf2", 57377848, "soundfonts/piano/UprightPianoKW-SF2-20220221/UprightPianoKW-20220221.sf2"),
    ("track-02.sf2", 31279314, "soundfonts/general-midi/GeneralUser_GS_SoftSynth_v1.44.sf2"),
    ("track-03.sf2", 10854982, "soundfonts/guitar/EGuitarFSBS-clean bridge small SF2-20260807/EGuitarFSBS-clean bridge small 20260807.sf2"),
    ("track-04.sf2", 19822546, "soundfonts/guitar/SpanishClassicalGuitar-SF2-20190618/SpanishClassicalGuitar-20190618.sf2"),
    ("track-05.sf2", 219362048, "soundfonts/drums/MuldjordKit-SF2-20201018/MuldjordKit 20201018.sf2"),
    ("track-06.sf2", 1653770, "soundfonts/drums/SynthesizerPercussion-SF2-20220718/SynthesizerPercussion-20220718.sf2"),
]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--assets", type=pathlib.Path, required=True)
    parser.add_argument("--site", type=pathlib.Path, required=True)
    args = parser.parse_args()
    if not (args.site / "index.html").is_file() or not (args.site / "app/index.html").is_file():
        sys.exit("STOP: missing website or application entry point")
    if not (args.site / "help/specs/index.html").is_file():
        sys.exit("STOP: missing official CSV specifications")
    if not (args.site / "help/soundfonts/index.html").is_file():
        sys.exit("STOP: missing SoundFont license page")
    for filename, size, relative in ASSETS:
        src = args.assets / filename
        if not src.is_file():
            sys.exit(f"STOP: missing SoundFont release asset: {filename}")
        got = src.stat().st_size
        if got != size:
            sys.exit(f"STOP: incorrect asset size {filename}: {got}, expected {size}")
    for filename, _, relative in ASSETS:
        dest = args.site / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(args.assets / filename, dest)
        print(f"PASS: {relative}")
    print("PASS: all six SoundFonts installed for publication")

if __name__ == "__main__":
    main()
