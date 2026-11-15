"""Original deterministic composition: Lanterns at First Light. No samples."""
import math, pathlib, subprocess, wave, hashlib, json
import numpy as np
SR=44100; BPM=108; B=60/BPM; N=64*4; OUT=pathlib.Path(__file__).resolve().parent.parent
PROG=[(50,[57,60,65]),(46,[53,57,60]),(53,[57,60,64]),(48,[55,60,64]),(50,[57,62,65]),(43,[55,58,62]),(46,[53,58,62]),(45,[52,57,61])]
MOTIF=[[74,76,77,81],[79,77,76,74],[72,74,77,76],[72,69,72,74],[77,81,84,81],[79,77,74,70],[74,77,76,72],[73,76,69,73]]
score=[]
def note(beat,dur,pitch,vel,part):
    score.append([round(beat,6),round(dur,6),pitch,round(vel,4),part])
for m in range(64):
    sec=m//16; k=m%8; root,ch=PROG[k]; t=m*4
    if sec==1: root+=3; ch=[p+3 for p in ch]
    if sec==3 and m>=60:
        root,ch=[(43,[55,58,62]),(46,[53,58,62]),(45,[52,57,61]),(50,[57,62,65])][m-60]
    gain=[.77,.88,1,.69][sec]*(1-.035*(m%4))
    if m==63:
        for p in [38,50,57,62,65,74]: note(t,4.0,p,.57,'piano')
        note(t,4,50,.36,'cello'); continue
    pattern=[root, ch[0],ch[1],ch[2],ch[1],ch[0],ch[1],ch[2]]
    for i,p in enumerate(pattern): note(t+i*.5,.70,p,.36*gain*(1.2 if i in (0,4) else .92),'piano')
    note(t,3.8,root-12,.37*gain,'cello')
    if sec>0: note(t+1.8,2.1,ch[0]-12,.26*gain,'cello')
    phrase=MOTIF[k][:]
    if sec==1: phrase=[p+3 for p in phrase[::-1]]
    if sec==2 and m%4==2: phrase=[phrase[0],phrase[1]+12,phrase[2],phrase[3]]
    if sec==3 and m%2: phrase=[phrase[0],phrase[3]]
    if m>=60: phrase=[[70,74,77,79],[77,74,70,69],[73,76,73,69]][m-60]
    rhythm=[(0,1.40),(1.5,.45),(2,.88),(3,1.05)] if len(phrase)==4 else [(0,1.8),(2,1.8)]
    for i,(p,(offset,dur)) in enumerate(zip(phrase,rhythm)):
        note(t+offset,dur,p,.66*gain*(1-.08*i),'piano')
    if sec in (1,2):
        for i,p in enumerate(ch[1:]): note(t+.07*i,3.65,p,.16*gain,'strings')
def render():
    n=round((N*B+3.5)*SR); audio=np.zeros((n,2),dtype=np.float64)
    for beat,dur,pitch,vel,part in score:
        start=round((beat*B+.15+.009*math.sin(beat*1.7))*SR)
        hold=dur*B; tail=1.65 if part=='piano' else .48
        t=np.arange(round((hold+tail)*SR))/SR; f=440*2**((pitch-69)/12); phase=2*np.pi*f*t
        if part=='piano':
            env=(1-np.exp(-t/.006))*np.exp(-t/(1.1+0.018*(80-pitch)))*np.exp(-np.maximum(t-hold,0)/.32)
            sig=sum(a*np.sin(phase*h*(1+.00022*h*h))*np.exp(-t*(h-1)*.55) for h,a in [(1,1),(2,.34),(3,.17),(4,.08),(5,.035)])*env
            pan=.5+.23*np.tanh((pitch-60)/18); amp=.115
        else:
            env=np.minimum(1,t/.18)*np.exp(-np.maximum(t-hold,0)/.17)
            vib=.13*np.sin(2*np.pi*5.1*t); sig=sum(a*np.sin(phase*h+vib*h) for h,a in [(1,1),(2,.28),(3,.14),(4,.065)])*env
            pan=.26 if part=='cello' else .75; amp=.065 if part=='cello' else .04
        sig*=vel*amp; end=min(n,start+len(sig)); sig=sig[:end-start]
        audio[start:end,0]+=sig*np.sqrt(1-pan); audio[start:end,1]+=sig*np.sqrt(pan)
    dry=audio.copy()
    for delay,g in [(0.039,.12),(.071,.09),(.119,.07),(.183,.05),(.271,.035),(.389,.02)]:
        k=int(delay*SR); audio[k:]+=g*dry[:-k,::-1]
    audio[-SR*2:]*=np.linspace(1,0,SR*2)[:,None]
    audio*=.83/max(np.max(np.abs(audio)),1e-9)
    pcm=np.round(audio*32767).astype('<i2')
    with wave.open(str(OUT/'Lanterns_at_First_Light.wav'),'wb') as w:
        w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(pcm.tobytes())
    return {'duration_s':len(pcm)/SR,'peak_dbfs':20*math.log10(np.max(np.abs(audio))), 'notes':len(score),'sha256':hashlib.sha256(pcm.tobytes()).hexdigest()}
if __name__=='__main__':
    (OUT/'source'/'score.json').write_text(json.dumps({'bpm':BPM,'time_signature':'4/4','notes':score,'columns':['beat','duration_beats','midi_pitch','velocity','part']},indent=2))
    a=render(); b=render(); assert a==b
    subprocess.run(['ffmpeg','-v','error','-y','-i',str(OUT/'Lanterns_at_First_Light.wav'),'-codec:a','libmp3lame','-b:a','192k',str(OUT/'Lanterns_at_First_Light.mp3')],check=True)
    subprocess.run(['ffmpeg','-v','error','-i',str(OUT/'Lanterns_at_First_Light.mp3'),'-f','null','-'],check=True)
    with wave.open(str(OUT/'Lanterns_at_First_Light.wav'),'rb') as w:
        assert w.getnchannels()==2 and w.getframerate()==SR and w.getsampwidth()==2
        assert hashlib.sha256(w.readframes(w.getnframes())).hexdigest()==a['sha256']
    (OUT/'verification.json').write_text(json.dumps({**a,'rerender_identical':True,'mp3_decode_pass':True,'wav_readback_pass':True},indent=2))
    print(json.dumps(a))
