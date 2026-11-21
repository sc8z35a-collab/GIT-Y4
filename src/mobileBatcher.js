import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * POCO F7 (Adreno 825 TBDR) Static Geometry Material-Bucketed Batcher.
 *
 * Traverses static architecture & furniture groups, splits multi-material BoxGeometries
 * cleanly by material group, bakes world transforms into vertex buffers, merges all
 * geometry sharing each unique Material instance, and disposes temporary buffers.
 *
 * Cuts static draw calls by ~70-80% while preserving exact shadow flags & interactive objects.
 */
export function batchStaticGroups(groups, excludeMeshes = new Set()) {
  const buckets = new Map(); // key = `${mat.uuid}|${cast}|${recv}` -> { mat, cast, recv, geoms: [] }
  const toRemove = [];
  let beforeMeshes = 0;

  groups.forEach((group) => {
    group.updateWorldMatrix(true, true);
    group.traverse((obj) => {
      if (!obj.isMesh || obj.isInstancedMesh) return;
      if (excludeMeshes.has(obj)) return;
      if (obj.userData.doorId || obj.userData.propId || obj.userData.noBatch) return;
      if (!obj.geometry) return;

      beforeMeshes++;
      const matList = Array.isArray(obj.material) ? obj.material : [obj.material];
      const baseGeo = obj.geometry;

      // Convert to non-indexed with guaranteed position, normal, uv attributes for clean merging
      const nonIdx = baseGeo.index ? baseGeo.toNonIndexed() : baseGeo.clone();
      if (!nonIdx.attributes.normal) nonIdx.computeVertexNormals();
      if (!nonIdx.attributes.uv) {
        const count = nonIdx.attributes.position.count;
        nonIdx.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
      }
      // Strip extraneous attributes that could block mergeGeometries
      for (const attr of Object.keys(nonIdx.attributes)) {
        if (attr !== 'position' && attr !== 'normal' && attr !== 'uv') {
          nonIdx.deleteAttribute(attr);
        }
      }
      nonIdx.applyMatrix4(obj.matrixWorld);

      const cast = Boolean(obj.castShadow);
      const recv = Boolean(obj.receiveShadow);

      if (Array.isArray(obj.material) && nonIdx.groups && nonIdx.groups.length > 0) {
        // Slice multi-material geometry per material face group
        const pos = nonIdx.attributes.position.array;
        const norm = nonIdx.attributes.normal.array;
        const uv = nonIdx.attributes.uv.array;
        for (const grp of nonIdx.groups) {
          const mat = matList[grp.materialIndex];
          if (!mat) continue;
          const sub = new THREE.BufferGeometry();
          const start = grp.start;
          const cnt = grp.count;
          sub.setAttribute('position', new THREE.BufferAttribute(pos.slice(start * 3, (start + cnt) * 3), 3));
          sub.setAttribute('normal', new THREE.BufferAttribute(norm.slice(start * 3, (start + cnt) * 3), 3));
          sub.setAttribute('uv', new THREE.BufferAttribute(uv.slice(start * 2, (start + cnt) * 2), 2));
          pushBucket(buckets, mat, cast, recv, sub);
        }
        nonIdx.dispose();
      } else {
        const mat = matList[0];
        if (mat) {
          nonIdx.clearGroups();
          pushBucket(buckets, mat, cast, recv, nonIdx);
        } else {
          nonIdx.dispose();
        }
      }
      toRemove.push(obj);
    });
  });

  // Remove original individual static meshes
  toRemove.forEach((m) => {
    if (m.parent) m.parent.remove(m);
    if (m.geometry) m.geometry.dispose();
  });

  // Merge each bucket into a single GPU-optimal BufferGeometry
  const batchedGroup = new THREE.Group();
  batchedGroup.name = 'BatchedStaticArchitecture';
  let afterDrawCalls = 0;
  let totalTriangles = 0;

  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.geoms, false);
    bucket.geoms.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, bucket.mat);
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = bucket.recv;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    batchedGroup.add(mesh);
    afterDrawCalls++;
    totalTriangles += Math.round(merged.attributes.position.count / 3);
  }

  return {
    batchedGroup,
    stats: {
      beforeMeshes,
      afterDrawCalls,
      reductionPct: beforeMeshes > 0 ? Math.round(((beforeMeshes - afterDrawCalls) / beforeMeshes) * 100) : 0,
      totalTriangles,
    },
  };
}

function pushBucket(buckets, mat, cast, recv, geo) {
  const key = `${mat.uuid}|${cast ? 1 : 0}|${recv ? 1 : 0}`;
  let b = buckets.get(key);
  if (!b) {
    b = { mat, cast, recv, geoms: [] };
    buckets.set(key, b);
  }
  b.geoms.push(geo);
}
