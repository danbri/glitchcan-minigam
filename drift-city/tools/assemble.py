import os, subprocess
ROOT=os.path.dirname(os.path.abspath(__file__))+'/../'
D=ROOT+'src/'
subprocess.run(['node',ROOT+'tools/bakeplaces.mjs'],check=True)
head=open(D+'head.html').read()
page=(head+'<script type="text/wgsl" id="wgsl-common">\n'+open(D+'common.wgsl').read()+'</script>\n'
      +'<script type="text/wgsl" id="wgsl-scene">\n'+open(D+'scene.wgsl').read()+'</script>\n'+'<script type="text/wgsl" id="wgsl-space">\n'+open(D+'space.wgsl').read()+'</script>\n'
      +'<script type="text/wgsl" id="wgsl-post">\n'+open(D+'post.wgsl').read()+'</script>\n'
      +'<script>\n(() => {\n"use strict";\n'+open(D+'tables.js').read()+'\n'+open(D+'world.js').read()+'\n'+open(D+'fallback.js').read()+'\n'+open(D+'titan.js').read()+'\n'+open(D+'audio.js').read()+'\nconst PLACES_BAKED = '+open(D+'places.json').read()+';\n'+open(D+'tales.js').read()+'\n'+open(D+'feel.js').read()+'\n'+open(D+'map.js').read()+'\n'+open(D+'main.js').read()+'\n})();\n</script>\n</body>\n</html>\n')
os.makedirs(ROOT+'dist',exist_ok=True)
open(ROOT+'dist/city.html','w').write(page)
print('page bytes', len(page))
