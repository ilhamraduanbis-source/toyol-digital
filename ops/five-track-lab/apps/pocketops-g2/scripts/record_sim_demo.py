#!/usr/bin/env python3
"""Capture genuine PNG pixels from a RUNNING Even Hub simulator during actual
gesture events and encode an MP4. This is a raw simulator evidence video,
NOT a hardware recording, AI inference, or an official competition submission.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
from urllib.request import Request, urlopen

BASE = os.environ.get("EVEN_SIM_URL", "http://127.0.0.1:9898")
OUT = Path(os.environ.get("EVEN_DEMO_OUT", "/tmp/pocketops-g2-simulator-real.mp4"))
FPS = 5

def get_frame():
    with urlopen(BASE + "/api/screenshot/glasses", timeout=8) as response:
        data = response.read()
    if not data.startswith(b"\x89PNG\r\n\x1a\n"):
        raise RuntimeError("Simulator did not return a real PNG frame")
    return data

def click():
    request = Request(BASE + "/api/input",
                      data=json.dumps({"action":"click"}).encode(),
                      headers={"Content-Type":"application/json"},
                      method="POST")
    with urlopen(request, timeout=8) as response:
        if response.status >= 300:
            raise RuntimeError("Simulator did not accept click")

def main():
    OUT.parent.mkdir(parents=True,exist_ok=True)
    command=[
        "ffmpeg","-hide_banner","-nostdin","-loglevel","error","-y",
        "-f","image2pipe","-framerate",str(FPS),"-c:v","png","-i","pipe:0",
        "-vf","scale=1152:576:flags=neighbor,pad=1152:630:0:0:black,"
              "drawtext=text='GENUINE EVEN HUB SIMULATOR - CLICK TEST / NOT DEVICE HARDWARE':"
              "fontcolor=white:fontsize=21:x=22:y=591",
        "-c:v","libx264","-pix_fmt","yuv420p","-crf","26","-preset","veryfast",
        "-movflags","+faststart",str(OUT)
    ]
    proc=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
    # 4 distinct real card states at 3s each, followed by return to the first.
    stages=[("screen-0",None),("screen-1","click"),("screen-2","click"),
            ("screen-3","click"),("screen-4","click")]
    snapshots=[]
    frame_count=0
    try:
        for label,gesture in stages:
            if gesture:
                click()
                time.sleep(.45)
            first=None
            for _ in range(FPS*3):
                tick=time.monotonic()
                frame=get_frame()
                if first is None: first=hashlib.sha256(frame).hexdigest()
                proc.stdin.write(frame)
                frame_count+=1
                delay=(1/FPS)-(time.monotonic()-tick)
                if delay>0:time.sleep(delay)
            snapshots.append((label,first))
        proc.stdin.close()
        proc.stdin=None
        stderr=proc.communicate(timeout=30)[1]
        if proc.returncode:
            raise RuntimeError("ffmpeg failed: "+stderr.decode(errors="replace")[-1200:])
        if len({x[1] for x in snapshots}) < 3:
            raise RuntimeError("Fewer than three distinct real simulator frames")
        if OUT.stat().st_size < 15000:
            raise RuntimeError("Demo file suspiciously small")
        print("EVEN_SIM_REAL_CAPTURE_PASS",OUT,"frames",frame_count,
              "states",len({x[1] for x in snapshots}),
              "bytes",OUT.stat().st_size)
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait()

if __name__=="__main__":
    main()
