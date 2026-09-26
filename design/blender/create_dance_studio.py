"""Photographic projection scene, not an animated/rigged human mesh.
The original generated studio photography is projected onto a studio plate.
The Blender camera's restrained dolly is mirrored by the web scroll renderer.
"""
import bpy, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
for mobile in [False,True]:
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    image=bpy.data.images.load(str(ROOT/('public/media/tde-dance-studio-mobile.jpg' if mobile else 'public/media/tde-dance-studio.jpg')))
    aspect=image.size[0]/image.size[1]
    bpy.ops.mesh.primitive_plane_add(size=2,rotation=(math.pi/2,0,0))
    plate=bpy.context.object;plate.name='StudioProjection';plate.scale=(aspect,1,1)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    material=bpy.data.materials.new('Photographic blue studio');material.use_nodes=True
    nodes=material.node_tree.nodes;nodes.clear()
    texture=nodes.new('ShaderNodeTexImage');texture.image=image
    emission=nodes.new('ShaderNodeEmission');emission.inputs['Strength'].default_value=1
    output=nodes.new('ShaderNodeOutputMaterial')
    material.node_tree.links.new(texture.outputs['Color'],emission.inputs['Color'])
    material.node_tree.links.new(emission.outputs[0],output.inputs['Surface'])
    plate.data.materials.append(material)
    suffix='-mobile' if mobile else ''
    bpy.ops.export_scene.gltf(filepath=str(ROOT/f'public/models/tde-dance-studio{suffix}.glb'),export_format='GLB',use_selection=True,export_image_format='JPEG',export_jpeg_quality=90)
    camera_data=bpy.data.cameras.new('Scroll dolly');camera=bpy.data.objects.new('Scroll dolly',camera_data);bpy.context.collection.objects.link(camera)
    camera.rotation_euler=(math.pi/2,0,0);camera_data.type='PERSP';camera_data.lens=35
    for frame,y,x in [(1,-3.9,-.018),(120,-3.65,.018)]:
        camera.location=(x,y,0);camera.keyframe_insert(data_path='location',frame=frame)
    scene=bpy.context.scene;scene.camera=camera;scene.frame_end=120;scene.render.resolution_x=image.size[0];scene.render.resolution_y=image.size[1]
    scene['asset_note']='AI-generated photographic studio concept. Dancer is a fictional adult model, not an actual school student. Camera projection, no skeletal character animation.'
    image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/f'design/blender/tde-dance-studio{suffix}.blend'))
print('STUDIO_PROJECTIONS_READY')
