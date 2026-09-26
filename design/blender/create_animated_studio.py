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
box('Sprung dance floor',(0,0,-.12),(12,10,.2),wood)
for x in range(-11,12):box('Floor board join',(x*.5,0,-.014),(.008,10,.004),line,0)
box('Back wall',(0,4.3,2.1),(12,.18,4.4),navy)
box('Left wall',(-6,0,2.1),(.15,8.6,4.4),navy)
box('Right wall',(6,0,2.1),(.15,8.6,4.4),navy)
box('Ceiling',(0,0,4.35),(12,8.6,.15),navy)
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

# Stylised faceless dance sculpture. Every segment and joint is animated in Blender.
segments={}
for name,a,b,r,m in [
 ('UpperArm_L','shoulderL','elbowL',.095,ice),('Forearm_L','elbowL','handL',.075,blue),
 ('UpperArm_R','shoulderR','elbowR',.095,ice),('Forearm_R','elbowR','handR',.075,blue),
 ('Thigh_L','hipL','kneeL',.135,blue),('Shin_L','kneeL','ankleL',.105,ice),
 ('Thigh_R','hipR','kneeR',.135,blue),('Shin_R','kneeR','ankleR',.105,ice)]:segments[name]=(cylinder(name,r,m),a,b)
joints={name:sphere('Joint_'+name,(0,0,0),(.11,.11,.11),joint) for name in ['shoulderL','shoulderR','elbowL','elbowR','hipL','hipR','kneeL','kneeR','ankleL','ankleR']}
head=sphere('Faceless ceramic head',(0,0,0),(.17,.155,.22),ice)
neck=cylinder('Neck',.07,joint)
chest=sphere('Sculpted torso',(0,0,0),(.3,.16,.38),ice)
waist=sphere('Blue waist',(0,0,0),(.21,.145,.17),blue)
hips=sphere('Pelvis',(0,0,0),(.25,.17,.15),joint)
hands={s:sphere('Hand_'+s,(0,0,0),(.065,.085,.12),ice) for s in ['L','R']}
feet={s:box('Trainer_'+s,(0,0,0),(.24,.43,.16),ice,.065) for s in ['L','R']}
# Five distinct grounded street-dance poses, interpolated into a continuous phrase.
poses=[
 {'cx':-.17,'lean':-.11,'drop':.04,'el':(-.58,-.1,1.55),'hl':(-.88,-.18,1.28),'er':(.48,-.1,1.8),'hr':(.62,-.2,2.17),'feet':(-.45,.42)},
 {'cx':.17,'lean':.14,'drop':.14,'el':(-.48,-.2,1.7),'hl':(-.17,-.38,1.95),'er':(.72,-.08,1.47),'hr':(1.02,-.2,1.2),'feet':(-.5,.55)},
 {'cx':-.05,'lean':-.06,'drop':0,'el':(-.68,-.05,1.96),'hl':(-.9,-.15,2.31),'er':(.63,-.06,1.9),'hr':(.87,-.1,2.23),'feet':(-.36,.36)},
 {'cx':-.19,'lean':-.18,'drop':.17,'el':(-.66,-.04,1.42),'hl':(-1.05,-.1,1.6),'er':(.35,-.27,1.65),'hr':(-.05,-.45,1.4),'feet':(-.58,.45)},
 {'cx':.13,'lean':.12,'drop':.04,'el':(-.54,-.1,1.57),'hl':(-.83,-.18,1.9),'er':(.6,-.08,1.65),'hr':(.94,-.1,1.9),'feet':(-.42,.48)},
]
animated=[o for o,a,b in segments.values()]+list(joints.values())+[head,neck,chest,waist,hips]+list(hands.values())+list(feet.values())
for frame in range(1,122,3):
 t=(frame-1)/120*4;i=min(3,int(t));f=t-i;f=f*f*(3-2*f)
 a=poses[i];b=poses[i+1]
 def mix(k):
  if isinstance(a[k],tuple):return tuple(v+(w-v)*f for v,w in zip(a[k],b[k]))
  return a[k]+(b[k]-a[k])*f
 cx=mix('cx');lean=mix('lean');drop=mix('drop');fl,fr=mix('feet')
 p={'hipL':(cx-.18,0,1.07-drop),'hipR':(cx+.18,0,1.07-drop),
 'shoulderL':(cx+lean-.31,0,1.78-drop),'shoulderR':(cx+lean+.31,0,1.78-drop),
 'kneeL':(fl*.8+cx*.15,-.12,.58-drop*.5),'kneeR':(fr*.8+cx*.15,-.12,.58-drop*.5),
 'ankleL':(fl,0,.19),'ankleR':(fr,0,.19),
 'elbowL':mix('el'),'handL':mix('hl'),'elbowR':mix('er'),'handR':mix('hr')}
 p={k:Vector((v[0]+1.35,v[1],v[2])) for k,v in p.items()}
 for o,a,b in segments.values():
  delta=p[b]-p[a];o.location=(p[a]+p[b])/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=delta.to_track_quat('Z','Y');o.scale.z=delta.length
 for name,o in joints.items():o.location=p[name]
 hips.location=(cx+1.35,0,1.08-drop);waist.location=(cx+lean*.4+1.35,0,1.26-drop)
 chest.location=(cx+lean*.75+1.35,0,1.57-drop);chest.rotation_euler.y=lean*.9
 neck.location=(cx+lean+1.35,0,1.94-drop);neck.scale.z=.14
 head.location=(cx+lean+1.35,-.015,2.13-drop);head.rotation_euler=(.08,lean*.6,-lean*.5)
 for side in ['L','R']:
  hands[side].location=p['hand'+side];feet[side].location=p['ankle'+side]+Vector((0,-.1,-.08));feet[side].rotation_euler.z=(-.15 if side=='L' else .15)+cx*.2
 for o in animated:
  o.location.z-=.05
  o.keyframe_insert(data_path='location',frame=frame)
  o.keyframe_insert(data_path='scale',frame=frame)
  o.keyframe_insert(data_path='rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler',frame=frame)
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
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.world.color=(.06,.06,.06)
scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=90
for mobile in [False,True]:
 cam.location=(1.6,-6.5,2.7) if not mobile else (1.45,-7.6,2.8)
 target=Vector((0,0,1.35)) if not mobile else Vector((1.35,0,1.4))
 cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
 scene.render.resolution_x=1440 if not mobile else 810;scene.render.resolution_y=1000 if not mobile else 1440;scene.render.resolution_percentage=100
 scene.render.filepath=str(ROOT/f'public/media/tde-animated-studio{"-mobile" if mobile else ""}.jpg')
 bpy.ops.render.render(write_still=True)
scene['description']='Actual studio geometry and 4-second baked articulated mannequin dance animation. No photographic projection.'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'design/blender/tde-animated-studio.blend'))
print('ANIMATED_STUDIO_READY')
