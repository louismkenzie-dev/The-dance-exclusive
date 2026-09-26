"""Original TDE sound-stage sculpture. Run with Blender --background --python this_file."""
import bpy, math
from mathutils import Vector
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, rgb, metallic=0, roughness=.3, emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*rgb,1)
    p.inputs['Metallic'].default_value=metallic; p.inputs['Roughness'].default_value=roughness
    if emission:
        p.inputs['Emission Color'].default_value=(*rgb,1); p.inputs['Emission Strength'].default_value=emission
    return m
blue=material('TDE / enamel blue',(0.005,.39,.66),.65,.24)
black=material('Soft touch graphite',(.009,.017,.027),.2,.38)
rubber=material('Speaker surrounds',(.015,.025,.038),.1,.55)
chrome=material('Brushed aluminium',(.46,.61,.7),.9,.22)
light=material('Ice blue light',(.025,.68,1),.3,.2,2)

def group(name, loc=(0,0,0)):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc; return o

def finish(o,name,mat,parent=None):
    o.name=name; o.data.materials.append(mat)
    if parent:o.parent=parent
    for p in o.data.polygons:p.use_smooth=True
    return o

def box(name,loc,size,mat,parent=None,bevel=.08):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    b=o.modifiers.new('Machined edges','BEVEL'); b.width=bevel; b.segments=3
    n=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return finish(o,name,mat,parent)

def ring(name,loc,radius,tube,mat,parent=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=10,location=loc,major_radius=radius,minor_radius=tube,rotation=(math.pi/2,0,0))
    return finish(bpy.context.object,name,mat,parent)

def disc(name,loc,radius,depth,mat,parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=radius,depth=depth,location=loc,rotation=(math.pi/2,0,0))
    return finish(bpy.context.object,name,mat,parent)

world=group('SoundSystem')
for side,x in [('SpeakerLeft',-2),('SpeakerRight',2)]:
    g=group(side,(x,0,0)); g.parent=world
    box(side+' / blue cabinet',(0,0,0),(1.65,.9,2.6),blue,g,.13)
    box(side+' / front baffle',(0,-.465,0),(1.48,.06,2.39),black,g,.1)
    for z,r in [(-.4,.58),(.75,.27)]:
        disc('Recess',(0,-.53,z),r,.06,black,g)
        ring('Rubber suspension',(0,-.60,z),r*.9,r*.09,rubber,g)
        disc('Brushed driver',(0,-.565,z),r*.73,.065,chrome,g)
        ring('Cone bevel',(0,-.61,z),r*.61,r*.07,chrome,g)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=r*.38,location=(0,-.65,z))
        o=bpy.context.object; o.scale.y=.45; finish(o,'Dust cap',black,g)
    for bx in [-.65,.65]:
        for bz in [-1.08,1.08]:disc('Inset bolt',(bx,-.515,bz),.035,.02,chrome,g)
    box('Blue cabinet edge',(0,-.52,-1.13),(1,.025,.025),light,g,.01)

deck=group('Deck'); deck.parent=world
box('Control deck',(0,0,-.18),(2.05,.82,2.25),black,deck,.12)
box('Blue face',(0,-.43,-.18),(1.95,.065,2.12),blue,deck,.08)
box('Display glass',(0,-.475,.36),(1.62,.04,.6),black,deck,.04)
for i in range(15):
    h=.12+.27*(.5+.5*math.sin(i*1.6))
    box('Equalizer bar',(i*.095-.665,-.506,.22+h/2),(.045,.012,h),light,deck,.005)
box('Tape deck',(0,-.48,-.45),(1.61,.06,.65),black,deck,.05)
for x in [-.43,.43]:
    ring('Tape reel',(x,-.525,-.45),.18,.025,chrome,deck)
    disc('Tape hub',(x,-.53,-.45),.045,.03,light,deck)
for x in [-.6,-.3,0,.3,.6]:box('Transport control',(x,-.48,-.91),(.2,.14,.11),chrome,deck,.025)
for x in [-.8,.8]:box('Handle upright',(x,0,1.39),(.13,.22,.62),chrome,deck,.05)
box('Carry handle',(0,0,1.67),(1.7,.25,.15),black,deck,.07)

halo=group('Halo'); halo.parent=world
ring('Sound wave',(0,.75,.12),3.36,.028,light,halo)
ring('Outer sound wave',(0,.78,.12),3.53,.012,blue,halo)
# A small set of floating beat marks, individually named for scroll choreography.
for i in range(8):
    a=i*math.tau/8+.15
    o=box('Beat_%02d'%i,(3.7*math.cos(a),.65,3.7*math.sin(a)+.12),(.3,.14,.08),chrome,world,.035)
    o.rotation_euler.y=-a

# Export only sculpture meshes and groups; studio lights/camera stay in .blend.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/tde-sound-stage.glb'),export_format='GLB',use_selection=True,export_apply=True)

scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.world.color=(.18,.18,.18)

def area(name,loc,power,color,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
area('Softbox key',(1,-6,7),1700,(.68,.87,1),7)
area('Blue rim',(-5,2,4),2000,(.05,.5,1),5)
area('Silver edge',(5,0,3),2200,(.9,.97,1),4)
camdata=bpy.data.cameras.new('Camera');cam=bpy.data.objects.new('Camera',camdata);bpy.context.collection.objects.link(cam)
cam.location=(5,-13,5);cam.rotation_euler=(Vector((0,0,.2))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=9
scene.camera=cam
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(ROOT/'design/blender/sound-stage-poster.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'design/blender/tde-sound-stage.blend'))
bpy.ops.render.render(write_still=True)
print('TDE_SCENE_READY')
