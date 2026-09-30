import sys, math, struct, subprocess, time
import numpy as np, wgpu
from PIL import Image
D='/home/claude/v3/'
common=open(D+'common.wgsl').read()+open(D+'gen/design.wgsl').read(); import os; scene=open(os.environ.get('SCENE', D+'scene.wgsl')).read(); post=open(D+'post.wgsl').read()
dev=wgpu.gpu.request_adapter_sync(power_preference='high-performance').request_device_sync()
sm=dev.create_shader_module(code=common+scene); pm=dev.create_shader_module(code=common+post)
F16=wgpu.TextureFormat.rgba16float; OUT=wgpu.TextureFormat.rgba8unorm
FR=wgpu.ShaderStage.FRAGMENT; VX=wgpu.ShaderStage.VERTEX; CO=wgpu.ShaderStage.COMPUTE
pxBGL=dev.create_bind_group_layout(entries=[{'binding':0,'visibility':VX|FR,'buffer':{'type':'uniform'}},{'binding':1,'visibility':VX,'texture':{'sample_type':'unfilterable-float'}}])
scBGL=dev.create_bind_group_layout(entries=[{'binding':0,'visibility':FR,'buffer':{'type':'uniform'}},{'binding':1,'visibility':FR,'texture':{'sample_type':'unfilterable-float'}},
  {'binding':2,'visibility':FR,'buffer':{'type':'uniform'}},{'binding':3,'visibility':FR,'texture':{'sample_type':'uint'}},{'binding':6,'visibility':FR,'texture':{'sample_type':'unfilterable-float'}},
  {'binding':7,'visibility':FR,'texture':{'sample_type':'unfilterable-float'}},{'binding':8,'visibility':FR,'texture':{'sample_type':'unfilterable-float'}},
  {'binding':11,'visibility':FR,'buffer':{'type':'uniform'}},{'binding':12,'visibility':FR,'buffer':{'type':'uniform'}},{'binding':13,'visibility':FR,'texture':{'sample_type':'unfilterable-float'}},{'binding':14,'visibility':FR,'texture':{'sample_type':'unfilterable-float'}},{'binding':15,'visibility':FR,'texture':{'sample_type':'unfilterable-float'}},{'binding':21,'visibility':FR,'buffer':{'type':'uniform'}},{'binding':22,'visibility':FR,'buffer':{'type':'uniform'}}])
coBGL=dev.create_bind_group_layout(entries=[{'binding':0,'visibility':CO,'buffer':{'type':'uniform'}},{'binding':12,'visibility':CO,'buffer':{'type':'uniform'}},{'binding':1,'visibility':CO,'texture':{'sample_type':'unfilterable-float'}},
  {'binding':2,'visibility':CO,'buffer':{'type':'uniform'}},{'binding':4,'visibility':CO,'storage_texture':{'access':'write-only','format':'rg32uint'}},{'binding':5,'visibility':CO,'buffer':{'type':'uniform','has_dynamic_offset':True}},
  {'binding':7,'visibility':CO,'texture':{'sample_type':'unfilterable-float'}},{'binding':8,'visibility':CO,'texture':{'sample_type':'unfilterable-float'}}])
trBGL=dev.create_bind_group_layout(entries=[{'binding':0,'visibility':CO,'buffer':{'type':'uniform'}},{'binding':1,'visibility':CO,'texture':{'sample_type':'unfilterable-float'}},{'binding':13,'visibility':CO,'texture':{'sample_type':'unfilterable-float'}},{'binding':9,'visibility':CO,'storage_texture':{'access':'write-only','format':'rgba32float'}},{'binding':10,'visibility':CO,'storage_texture':{'access':'write-only','format':'rgba32float'}}])
def pl(b): return dev.create_pipeline_layout(bind_group_layouts=[b])
P_pxC=dev.create_render_pipeline(layout=pl(pxBGL),vertex={'module':sm,'entry_point':'vsCell'},fragment={'module':sm,'entry_point':'fsProxy','targets':[{'format':'r32float'}]},primitive={'topology':'triangle-list','cull_mode':'none'},depth_stencil={'format':'depth24plus','depth_write_enabled':True,'depth_compare':'less'})
P_pxG=dev.create_render_pipeline(layout=pl(pxBGL),vertex={'module':sm,'entry_point':'vsGiant'},fragment={'module':sm,'entry_point':'fsProxy','targets':[{'format':'r32float'}]},primitive={'topology':'triangle-list','cull_mode':'none'},depth_stencil={'format':'depth24plus','depth_write_enabled':True,'depth_compare':'less'})
def rp(mod,ep,fmt,layout='auto'): return dev.create_render_pipeline(layout=layout,vertex={'module':mod,'entry_point':'vs'},fragment={'module':mod,'entry_point':ep,'targets':[{'format':fmt}]},primitive={'topology':'triangle-list'})
P_scene=rp(sm,'scene',F16,pl(scBGL))
P_sh=dev.create_compute_pipeline(layout=pl(coBGL),compute={'module':sm,'entry_point':'shadowBuild'})
P_tr=dev.create_compute_pipeline(layout=pl(trBGL),compute={'module':sm,'entry_point':'treeBuild'})
SO=lambda b:{'binding':b,'visibility':CO,'storage_texture':{'access':'write-only','format':'rgba32float'}}
TX=lambda b:{'binding':b,'visibility':CO,'texture':{'sample_type':'unfilterable-float'}}
tbBGL=dev.create_bind_group_layout(entries=[{'binding':0,'visibility':CO,'buffer':{'type':'uniform'}},SO(16),{'binding':20,'visibility':CO,'buffer':{'type':'uniform'}}]); mbBGL=dev.create_bind_group_layout(entries=[TX(13),TX(14),SO(18)]); mdBGL=dev.create_bind_group_layout(entries=[TX(17),SO(18)])
P_terr=dev.create_compute_pipeline(layout=pl(tbBGL),compute={'module':sm,'entry_point':'terrBuild'})
P_mb=dev.create_compute_pipeline(layout=pl(mbBGL),compute={'module':sm,'entry_point':'mipBase'})
P_md=dev.create_compute_pipeline(layout=pl(mdBGL),compute={'module':sm,'entry_point':'mipDown'})
P_taa=rp(pm,'taa',F16); P_down=rp(pm,'bloomDown',F16); P_bh=rp(pm,'blurH',F16); P_bv=rp(pm,'blurV',F16); P_comp=rp(pm,'comp',OUT)
W,H=int(sys.argv[1]),int(sys.argv[2])
RT=wgpu.TextureUsage.RENDER_ATTACHMENT|wgpu.TextureUsage.TEXTURE_BINDING|wgpu.TextureUsage.COPY_SRC
def tex(w,h,f=F16): return dev.create_texture(size=(w,h,1),format=f,usage=RT)
sceneT=tex((W+1)//2,H); hist=[tex(W,H),tex(W,H)]; bA=tex(W//4,H//4); bB=tex(W//4,H//4); outT=tex(W,H,OUT)
pxT=tex(W,H,'r32float'); pxD=dev.create_texture(size=(W,H,1),format='depth24plus',usage=wgpu.TextureUsage.RENDER_ATTACHMENT)
NC=96; SN=1024; STS=0.8
cellT=dev.create_texture(size=(NC*3,NC,1),format=wgpu.TextureFormat.rgba32float,usage=wgpu.TextureUsage.TEXTURE_BINDING|wgpu.TextureUsage.COPY_DST)
TU=wgpu.TextureUsage.STORAGE_BINDING|wgpu.TextureUsage.TEXTURE_BINDING
trA=dev.create_texture(size=(384,384,1),format='rgba32float',usage=TU); trB=dev.create_texture(size=(384,384,1),format='rgba32float',usage=TU)
shT=dev.create_texture(size=(SN,SN,1),format='rg32uint',usage=wgpu.TextureUsage.STORAGE_BINDING|wgpu.TextureUsage.TEXTURE_BINDING)
ub=dev.create_buffer(size=272,usage=wgpu.BufferUsage.UNIFORM|wgpu.BufferUsage.COPY_DST)
spb=dev.create_buffer(size=48,usage=wgpu.BufferUsage.UNIFORM|wgpu.BufferUsage.COPY_DST)
rb=dev.create_buffer(size=256*16,usage=wgpu.BufferUsage.UNIFORM|wgpu.BufferUsage.COPY_DST)
smp=dev.create_sampler(mag_filter='linear',min_filter='linear')
import json
evb=dev.create_buffer(size=576,usage=wgpu.BufferUsage.UNIFORM|wgpu.BufferUsage.COPY_DST)
TUS=wgpu.TextureUsage
terrT=dev.create_texture(size=(768,768,1),format='rgba32float',usage=TUS.STORAGE_BINDING|TUS.TEXTURE_BINDING)
ffBT=dev.create_texture(size=(768,768,1),format='rgba32float',usage=TUS.TEXTURE_BINDING|TUS.COPY_DST)
ffMT=dev.create_texture(size=(768,768,1),format='rgba32float',usage=TUS.STORAGE_BINDING|TUS.TEXTURE_BINDING,mip_level_count=9)
if (not os.path.exists(D+'ff.bin')) or os.path.getmtime(D+'ff.bin') < os.path.getmtime(D+'world.js'):
  subprocess.run(['node',D+'ffgen.js',D+'ff.bin'],check=True)
dev.queue.write_texture({'texture':ffBT},np.fromfile(D+'ff.bin',np.float32).tobytes(),{'bytes_per_row':768*16,'rows_per_image':768},(768,768,1))
REGV=[float(x) for x in os.environ.get('REG','0,0,0,1,0,0,0,0').split(',')]
geob=dev.create_buffer(size=832,usage=wgpu.BufferUsage.UNIFORM|wgpu.BufferUsage.COPY_DST)
GEOV=json.load(open(os.environ.get('GEOJ',D+'geo_home.json')))
dev.queue.write_buffer(geob,0,struct.pack('208f',*GEOV))
SKYG=json.load(open(D+'skygeom.json'))
dev.queue.write_buffer(ub,240,struct.pack('8f',*REGV))
_enc=dev.create_command_encoder(); _c=_enc.begin_compute_pass()
_c.set_pipeline(P_terr); _c.set_bind_group(0,dev.create_bind_group(layout=tbBGL,entries=[{'binding':0,'resource':{'buffer':ub,'offset':0,'size':272}},{'binding':16,'resource':terrT.create_view()},{'binding':20,'resource':{'buffer':geob,'offset':0,'size':832}}])); _c.dispatch_workgroups(96,96); _c.end(); dev.queue.submit([_enc.finish()])
_enc=dev.create_command_encoder(); _c=_enc.begin_compute_pass()
_c.set_pipeline(P_mb); _c.set_bind_group(0,dev.create_bind_group(layout=mbBGL,entries=[{'binding':13,'resource':terrT.create_view()},{'binding':14,'resource':ffBT.create_view()},{'binding':18,'resource':ffMT.create_view(base_mip_level=0,mip_level_count=1)}])); _c.dispatch_workgroups(96,96); _c.end(); dev.queue.submit([_enc.finish()])
for _k in range(1,9):
  _enc=dev.create_command_encoder(); _c=_enc.begin_compute_pass(); _c.set_pipeline(P_md)
  _c.set_bind_group(0,dev.create_bind_group(layout=mdBGL,entries=[{'binding':17,'resource':ffMT.create_view(base_mip_level=_k-1,mip_level_count=1)},{'binding':18,'resource':ffMT.create_view(base_mip_level=_k,mip_level_count=1)}]))
  _n=768>>_k; _c.dispatch_workgroups((_n+7)//8,(_n+7)//8); _c.end(); dev.queue.submit([_enc.finish()])
tbb=dev.create_buffer_with_data(data=np.array(json.load(open(D+'tables.json')),dtype=np.uint32).tobytes(),usage=wgpu.BufferUsage.UNIFORM)
U={'buffer':ub,'offset':0,'size':272}
bg_px=dev.create_bind_group(layout=pxBGL,entries=[{'binding':0,'resource':U},{'binding':1,'resource':cellT.create_view()}])
flb=dev.create_buffer(size=3152,usage=wgpu.BufferUsage.UNIFORM|wgpu.BufferUsage.COPY_DST)
FLV=[0.0]*788
if os.environ.get('FLOCK'):
  fx,fy,fz,hx,hz=[float(v) for v in os.environ['FLOCK'].split(',')]
  import random; random.seed(3)
  FLV[0]=24
  FLV[4:8]=[fx,fy,fz,90.0]; FLV[8:12]=[fx,fy,fz,90.0]; FLV[12:16]=[fx,fy,fz,90.0]; FLV[16:20]=[fx,fy,fz,90.0]
  for i in range(24):
    s=2.5+4*random.random()**2; px=fx+random.uniform(-40,40); py=fy+random.uniform(-15,15); pz=fz+random.uniform(-40,40)
    l=math.hypot(hx,hz); FLV[20+i*8:28+i*8]=[px,py,pz,s,hx/l,0.05*random.uniform(-1,1),hz/l,random.uniform(0,6.28)]
dev.queue.write_buffer(flb,0,struct.pack('788f',*FLV))
prb=dev.create_buffer(size=1040,usage=wgpu.BufferUsage.UNIFORM|wgpu.BufferUsage.COPY_DST)
PRV=json.load(open(os.environ['PROPS'])) if os.environ.get('PROPS') else [0.0]*260
dev.queue.write_buffer(prb,0,struct.pack('260f',*PRV))
bg_sc=dev.create_bind_group(layout=scBGL,entries=[{'binding':0,'resource':U},{'binding':1,'resource':cellT.create_view()},{'binding':2,'resource':{'buffer':spb,'offset':0,'size':48}},{'binding':3,'resource':shT.create_view()},{'binding':6,'resource':pxT.create_view()},{'binding':7,'resource':trA.create_view()},{'binding':8,'resource':trB.create_view()},{'binding':11,'resource':{'buffer':evb,'offset':0,'size':576}},{'binding':12,'resource':{'buffer':tbb,'offset':0,'size':1040}},{'binding':13,'resource':terrT.create_view()},{'binding':14,'resource':ffBT.create_view()},{'binding':15,'resource':ffMT.create_view()},{'binding':21,'resource':{'buffer':flb,'offset':0,'size':3152}},{'binding':22,'resource':{'buffer':prb,'offset':0,'size':1040}}])
bg_co=dev.create_bind_group(layout=coBGL,entries=[{'binding':0,'resource':U},{'binding':12,'resource':{'buffer':tbb,'offset':0,'size':1040}},{'binding':1,'resource':cellT.create_view()},{'binding':2,'resource':{'buffer':spb,'offset':0,'size':48}},{'binding':4,'resource':shT.create_view()},{'binding':5,'resource':{'buffer':rb,'offset':0,'size':16}},{'binding':7,'resource':trA.create_view()},{'binding':8,'resource':trB.create_view()}])
bg_tr=dev.create_bind_group(layout=trBGL,entries=[{'binding':0,'resource':U},{'binding':1,'resource':cellT.create_view()},{'binding':13,'resource':terrT.create_view()},{'binding':9,'resource':trA.create_view()},{'binding':10,'resource':trB.create_view()}])
def bgp(p,ents): return dev.create_bind_group(layout=p.get_bind_group_layout(0),entries=[{'binding':b,'resource':r} for b,r in ents])
bg_taa=[bgp(P_taa,[(0,U),(2,sceneT.create_view()),(3,hist[1-i].create_view()),(4,smp)]) for i in range(2)]
bg_down=[bgp(P_down,[(4,smp),(5,hist[i].create_view())]) for i in range(2)]
bg_bh=bgp(P_bh,[(4,smp),(5,bA.create_view())]); bg_bv=bgp(P_bv,[(4,smp),(5,bB.create_view())])
bg_comp=[bgp(P_comp,[(0,U),(4,smp),(5,hist[i].create_view()),(6,bA.create_view())]) for i in range(2)]
exec(open(D+'presets.py').read())
def n3(v): l=math.sqrt(sum(a*a for a in v)); return [a/l for a in v]
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def halton(i,b):
  f=1;r=0
  while i>0: f/=b; r+=f*(i%b); i//=b
  return r
def rpass(pipe,bg,view,extra=None,draws=None):
  enc=dev.create_command_encoder()
  kw={}
  if extra: kw['depth_stencil_attachment']=extra
  p=enc.begin_render_pass(color_attachments=[{'view':view,'load_op':'clear','store_op':'store','clear_value':(1e9 if draws else 0,0,0,1)}],**kw)
  if draws:
    for pp,cnt in draws: p.set_pipeline(pp); p.set_bind_group(0,bg); p.draw(36,cnt)
  else:
    p.set_pipeline(pipe); p.set_bind_group(0,bg); p.draw(3)
  p.end(); dev.queue.submit([enc.finish()])
def wait():
  dev.queue.read_texture({'texture':outT,'origin':(0,0,0)},{'bytes_per_row':W*4,'rows_per_image':H},(1,1,1))
def render(x,y,z,yaw,pitch,pi,out,frames=8,mode='new',timing=False):
  subprocess.run(['node',D+'gencells.js',str(x),str(z),D+'c.bin'],check=True)
  dev.queue.write_texture({'texture':cellT},np.fromfile(D+'c.bin',np.float32).tobytes(),{'bytes_per_row':NC*3*16,'rows_per_image':NC},(NC*3,NC,1))
  p=presets[pi]; cp=math.cos(pitch); f=[math.cos(yaw)*cp,math.sin(pitch),math.sin(yaw)*cp]
  r=n3([-f[2],0,f[0]]); up=n3([r[1]*f[2]-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]-r[1]*f[0]])
  L=n3(p['sun'])
  if L[1]<0.25:
    h=math.hypot(L[0],L[2]); k=math.sqrt(1-0.0625)/h; L=[L[0]*k,0.25,L[2]*k]
  lx=n3([L[2],0,-L[0]]); ly=cross(L,lx)
  gen = 3 if mode in ('new','shadowonly') else 5
  dev.queue.write_buffer(spb,0,struct.pack('12f',*lx,STS,*ly,SN,*L,gen))
  inside = 1.0 if mode in ('ref','shadowonly') else 0.0
  def setU(fr):
    j=[halton(fr//2%16+1,2)-0.5,halton(fr//2%16+1,3)-0.5]
    Uv=[W,H,float(os.environ.get('TIME','10')),1, x,y,z,0.72, *f,fr, *r,1 if fr>0 else 0, *up,3.0, *n3(p['sun']),2.0, *p['sunCol'],p['win'], *p['skyTop'],p['stars'], *p['skyHor'],inside, *p['fog'],p['den'], *j,W,H, x,y,z,0, *f,0,*r,float(os.environ.get('RAIN','0')),*up,float(os.environ.get('WET','0'))]
    dev.queue.write_buffer(ub,0,struct.pack('68f',*(list(Uv)[:60]+REGV)))
  setU(0)
  E=[0.0]*144
  E[120:136]=SKYG
  if os.environ.get('BLK'): E[136:140]=[float(v) for v in os.environ['BLK'].split(',')]
  if os.environ.get('STEAM'): E[140:144]=[float(v) for v in os.environ['STEAM'].split(',')]
  E[72+3]=-1; E[80+3]=-1; E[84+3]=-1; E[88+3]=-1; E[104+3]=-1; E[108+3]=-1; E[112+3]=-1; E[116+3]=-1
  if os.environ.get('BLIMP'):
    E[56:60]=[x+f[0]*150, y+40, z+f[2]*150, 32]; E[60:64]=[-f[2],0,f[0],1]
  if os.environ.get('KOI'):
    E[48:52]=[x+f[0]*150, y+35, z+f[2]*150, 80]; E[52:56]=[-f[2],0.04,f[0],1.0]
  if os.environ.get('BEAM'):
    for i in range(2):
      E[i*4:i*4+4]=[x+f[0]*(60+40*i)+r[0]*(i*30-15), 70, z+f[2]*(60+40*i)+r[2]*(i*30-15), 1.0]; E[16+i*4:20+i*4]=[0.25*(i*2-1),-0.95,0.2,0.09]
  if os.environ.get('SMOKE'):
    E[32:36]=[x+f[0]*70+r[0]*12, 12, z+f[2]*70+r[2]*12, 1.0]
  env=os.environ.get
  E[68]=float(env('AURORA','0')); E[69]=float(env('RAINBOW','0')); E[70]=float(env('NEON','0.5')); E[71]=float(env('FROST','0.3'))
  if env('METEOR'):
    E[72:76]=[f[0]-0.3,0.5,f[2]+0.2,0.6]; E[76:80]=[f[0]+0.3,0.3,f[2]-0.1,1.2]
  if env('FW'):
    for i in range(3):
      E[80+i*4:84+i*4]=[x+f[0]*300+r[0]*(i-1)*90, 220+i*20, z+f[2]*300+r[2]*(i-1)*90, 0.6+i*0.5]
      E[92+i*4:96+i*4]=[[1,0.3,0.6],[0.3,0.8,1],[1,0.8,0.3]][i]+[60]
  if env('LAUNCH'):
    E[104:108]=[x+f[0]*900, 0, z+f[2]*900, float(env('LAUNCH'))]
  if env('BALLOON'):
    for i in range(3):
      E[108+i*4:112+i*4]=[x+f[0]*(90+60*i)+r[0]*(i-1)*50, y+10+i*8, z+f[2]*(90+60*i)+r[2]*(i-1)*50, 0.13+i*0.31]
  dev.queue.write_buffer(evb,0,struct.pack('144f',*E))
  enc=dev.create_command_encoder(); c=enc.begin_compute_pass(); c.set_pipeline(P_tr); c.set_bind_group(0,bg_tr); c.dispatch_workgroups(48,48); c.end(); dev.queue.submit([enc.finish()])
  # fill shadow map around camera (build with gen 3); ref mode uses gen 5 lookups -> always fallback
  tsh=0
  if True:
    dev.queue.write_buffer(spb,0,struct.pack('12f',*lx,STS,*ly,SN,*L,3))
    cu=math.floor(dot([x,y,z],lx)/STS); cv=math.floor(dot([x,y,z],ly)/STS)
    rects=[(cu-SN//2, cv-SN//2+k*128, SN, 128) for k in range(8)]
    dev.queue.write_buffer(rb,0,b''.join(struct.pack('4i',*rc)+b'\0'*240 for rc in rects))
    t0=time.time()
    enc=dev.create_command_encoder(); c=enc.begin_compute_pass(); c.set_pipeline(P_sh)
    for i,rc in enumerate(rects): c.set_bind_group(0,bg_co,[i*256]); c.dispatch_workgroups((rc[2]+7)//8,(rc[3]+7)//8)
    c.end(); dev.queue.submit([enc.finish()]); wait(); tsh=time.time()-t0
    dev.queue.write_buffer(spb,0,struct.pack('12f',*lx,STS,*ly,SN,*L,gen))
  tp=ts=0
  for fr in range(frames):
    setU(fr); cur=fr%2
    t0=time.time()
    rpass(None,bg_px,pxT.create_view(),{'view':pxD.create_view(),'depth_load_op':'clear','depth_store_op':'store','depth_clear_value':1.0},[(P_pxC,NC*NC),(P_pxG,169)])
    if timing: wait(); t1=time.time(); tp+=t1-t0
    rpass(P_scene,bg_sc,sceneT.create_view())
    if timing: wait(); ts+=time.time()-t1
    rpass(P_taa,bg_taa[cur],hist[cur].create_view()); rpass(P_down,bg_down[cur],bA.create_view()); rpass(P_bh,bg_bh,bB.create_view()); rpass(P_bv,bg_bv,bA.create_view()); rpass(P_comp,bg_comp[cur],outT.create_view())
  if os.environ.get('COUNT'):
    sd=dev.queue.read_texture({'texture':sceneT,'origin':(0,0,0)},{'bytes_per_row':((W+1)//2)*8,'rows_per_image':H},((W+1)//2,H,1)); a=np.frombuffer(sd,np.float16).reshape(H,(W+1)//2,4).astype(np.float32)
    cellhit=a[...,3]==1
    print('evals/px mean %.1f p95 %.0f | treeQuad loads/px %.1f | cells visited/px %.1f | cell-hit px %.2f | evals on cell-hit px %.1f' % (a[...,0].mean(), np.percentile(a[...,0],95), a[...,1].mean(), a[...,2].mean(), cellhit.mean(), a[...,0][cellhit].mean() if cellhit.any() else 0))
  d=dev.queue.read_texture({'texture':outT,'origin':(0,0,0)},{'bytes_per_row':W*4,'rows_per_image':H},(W,H,1))
  Image.fromarray(np.frombuffer(d,np.uint8).reshape(H,W,4)[:,:,:3]).save(out)
  print(out, mode, 'shadowmap-fill %.2fs'%tsh, 'proxy %.3f scene %.3f s/frame'%(tp/frames, ts/frames) if timing else '')
args=sys.argv[3:]
for a in args:
  v=a.split(','); render(float(v[0]),float(v[1]),float(v[2]),float(v[3]),float(v[4]),int(v[5]),v[6], int(v[7]) if len(v)>7 else 8, v[8] if len(v)>8 else 'new', True)
