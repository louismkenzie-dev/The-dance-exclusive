"""Actual geometry + baked dance animation; no photographic textures or video."""
import bpy, math
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def mat(name,color,metal=0,rough=.4,emit=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if emit:p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emit
 return m
navy=mat('Midnight studio',(.008,.025,.05),.15,.5)
blue=mat('Brand blue enamel',(.003,.39,.65),.5,.25)
ice=mat('Pearl ceramic',(.67,.83,.89),.35,.25)
joint=mat('Dark joints',(.017,.04,.07),.6,.3)
led=mat('Cyan studio lighting',(.005,.6,1),.1,.25,3)
wood=mat('Studio floor',(.18,.13,.09),.1,.5)
line=mat('Floor joins',(.045,.04,.035),0,.7)
glass=mat('Blue studio glass',(.03,.1,.16),.75,.2)

def finish(o,name,material):
 o.name=name;o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
 return o

def box(name,loc,size,material,bevel=.04):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:b=o.modifiers.new('Soft edges','BEVEL');b.width=bevel;b.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return finish(o,name,material)

def sphere(name,loc,scale,material):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=loc);o=bpy.context.object;o.scale=scale;return finish(o,name,material)

def cylinder(name,radius,material):
 bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=radius,depth=1);o=bpy.context.object
 b=o.modifiers.new('Rounded ends','BEVEL');b.width=.04;b.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return finish(o,name,material)

# Actual studio geometry; open front for the camera.
box('Sprung dance floor',(0,0,-.12),(12,18,.2),wood)
for x in range(-11,12):box('Floor board join',(x*.5,0,-.014),(.008,18,.004),line,0)
box('Back wall',(0,4.3,2.1),(12,.18,4.4),navy)
box('Left wall',(-6,0,2.1),(.15,8.6,4.4),navy)
box('Right wall',(6,0,2.1),(.15,8.6,4.4),navy)
# Open camera side: keep a continuous floor and no roof edge in portrait framing.
box('Ceiling lighting rail',(0,.3,4.18),(11.5,.045,.06),joint,.01)
for x in [-4.7,-1.6,1.6,4.7]:
 box('Mirror surround',(x,4.16,2.05),(2.65,.13,3.4),joint)
 box('Tinted studio panel',(x,4.07,2.05),(2.48,.055,3.24),glass,.015)
 # Narrow brushed highlights read as architectural glass rather than fake reflections.
 box('Panel light reflection',(x+1.05,4.03,2.1),(.015,.018,3.08),blue,.005)
box('Back wall LED',(0,4.04,3.9),(11.65,.035,.045),led,.015)
box('Skirting LED',(0,4.02,.12),(11.65,.035,.025),led,.01)
for x in [-5.65,5.65]:
 box('Vertical LED',(x,4.04,2),(.04,.04,3.8),led,.015)
 box('Ceiling light',(x/2,0,4.19),(.045,7.4,.035),led,.015)
# Low studio bench at the rear; no floating props.
box('Studio bench',(-3.9,3.4,.43),(2.3,.5,.13),blue,.06)
for x in [-4.75,-3.05]:box('Bench leg',(x,3.4,.19),(.08,.32,.38),joint)

# A real studio sound system: textured cabinetry, recessed cones and brushed rims.
# The room wakes in three beats: sound, floor choreography, then overhead lights.
rubber=mat('Speaker surround',(.008,.012,.018),.1,.86)
metal=mat('Brushed aluminium',(.27,.34,.39),.85,.32)
cone=mat('Graphite speaker cone',(.023,.03,.045),.3,.65)
animated=[]
cones=[]
for side,x in [('L',-2.5),('R',2.5)]:
 box('Speaker cabinet '+side,(x,2.2,1.02),(.8,.66,1.85),joint,.055)
 box('Speaker plinth '+side,(x,2.2,.08),(.92,.8,.13),rubber,.025)
 for n,z,r in [('Bass',.68,.29),('Mid',1.34,.2),('Tweeter',1.72,.065)]:
  for suffix,radius,depth,material in [('rim',r+.025,.06,metal),('surround',r,.07,rubber),('cone',r*.82,.075,cone)]:
   o=cylinder(n+' '+suffix+' '+side,radius,material);o.rotation_euler.x=math.pi/2;o.scale.z=depth;o.location=(x,1.835,z)
   if suffix=='cone':cones.append(o)
  cap=sphere(n+' dustcap '+side,(x,1.77,z),(r*.36,.06,r*.36),joint)
  cones.append(cap)
 box('Speaker status '+side,(x,1.85,.21),(.11,.025,.018),led,.004)
# A wall-mounted studio mixer: functional controls, no generic floating props.
box('Mixer console',(0,3.7,1.03),(1.5,.65,.15),joint,.035)
for x in [-.6,.6]:box('Console support',(x,3.77,.52),(.045,.4,1.0),metal,.01)
for i in range(8):
 x=-.55+i*.155
 box('Fader channel',(x,3.56,1.11),(.012,.2,.004),metal,.002)
 box('Fader cap',(x,3.55+.05*math.sin(i),1.125),(.07,.04,.025),ice,.008)
for i in range(24):
 x=-.65+i*.055
 o=box('Beat meter '+str(i),(x,3.95,1.43),(.025,.03,.28),led,.005)
 animated.append(('meter',o,i))
# Sequential rehearsal markings on the sprung floor, forming a travelling phrase.
for i in range(8):
 x=(-.62 if i%2==0 else .62)+.13*math.sin(i)
 y=-1.8+i*.53
 for dx,dy,w,h in [(-.2,0,.024,.38),(.2,0,.024,.38),(0,-.18,.4,.024),(0,.18,.4,.024)]:
  o=box('Choreography mark '+str(i),(x+dx,y+dy,.006),(w,h,.009),led,.003)
  animated.append(('step',o,i))
# Architectural acoustic fins and articulated ceiling fixtures.
for side in [-1,1]:
 for i in range(12):box('Acoustic wall fin',(side*(3.15+i*.18),4.01,2.1),(.04,.12,3.35),navy,.006)
for i,x in enumerate([-3,-1,1,3]):
 mount=bpy.data.objects.new('Moving light mount '+str(i),None);bpy.context.collection.objects.link(mount);mount.location=(x,.3,3.85)
 o=cylinder('Studio spot housing '+str(i),.13,joint);o.scale.z=.3;o.parent=mount;o.location=(0,0,-.1)
 o=cylinder('Studio spot lens '+str(i),.115,led);o.scale.z=.015;o.parent=mount;o.location=(0,0,-.26)
 animated.append(('spot',mount,i))
# Bake real object movement to glTF. Scroll is the clock, no unattended animation loop.
for frame in range(1,122,3):
 t=(frame-1)/120
 for i,o in enumerate(cones):
  if frame==1:o['rest_y']=o.location.y
  o.location.y=o['rest_y']-.045*math.sin(t*math.pi*16+i*.6)*(1-.45*t)
  o.keyframe_insert(data_path='location',frame=frame)
 for kind,o,i in animated:
  if kind=='meter':o.scale.z=.2+.8*abs(math.sin(t*math.pi*12+i*.65))
  elif kind=='step':
   phase=max(0,min(1,(t-.2-i*.045)*7))
   o.scale.x=o.scale.y=max(.001,phase)
  else:o.rotation_euler=(.28*math.sin(t*math.pi*2+i),.4*math.sin(t*math.pi+i*.7),0)
  o.keyframe_insert(data_path='rotation_euler' if kind=='spot' else 'scale',frame=frame)
scene=bpy.context.scene;scene.frame_start=1;scene.frame_end=121;scene.render.fps=30;scene.frame_set(1)
# One scene-wide action, exported as a scrubbable clip.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/tde-animated-studio.glb'),export_format='GLB',use_selection=True,export_apply=True,export_animations=True,export_animation_mode='SCENE',export_frame_range=True,export_force_sampling=True)

def area(name,loc,power,color,size):
 data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
 o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((1,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
area('Studio soft key',(0,-3,4),1300,(.8,.91,1),5)
area('Blue rim',(4,2,3),1600,(.03,.5,1),3)
area('Fill',(-3,-1,2.7),700,(.4,.75,1),4)
camdata=bpy.data.cameras.new('Scroll camera');cam=bpy.data.objects.new('Scroll camera',camdata);bpy.context.collection.objects.link(cam)
camdata.lens=40;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.world.color=(.06,.06,.06)
scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=90
scene.frame_set(91)
for mobile in [False,True]:
 camdata.sensor_fit='VERTICAL' if mobile else 'AUTO';camdata.sensor_height=32;camdata.lens=28.86 if mobile else 40
 cam.location=(2.7,-6.8,3.6) if not mobile else (.3,-11.15,4.85)
 target=Vector((0,1.2,1.05)) if not mobile else Vector((0,1.2,1.05))
 cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.render.resolution_x=1440 if not mobile else 810;scene.render.resolution_y=1000 if not mobile else 1440;scene.render.resolution_percentage=100
 scene.render.filepath=str(ROOT/f'public/media/tde-animated-studio{"-mobile" if mobile else ""}.jpg')
 bpy.ops.render.render(write_still=True)
scene['description']='Blender sound studio. Animated speaker cones, beat meters, rehearsal floor markings and ceiling fixtures. Scroll-directed three-act lighting in the browser.'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'design/blender/tde-animated-studio.blend'))
print('ANIMATED_STUDIO_READY')
