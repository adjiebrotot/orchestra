import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Mesh,
  SRGBColorSpace,
  SkinnedMesh,
} from 'three';
import type { MeshStandardMaterial, Object3D } from 'three';

import { playerJoint } from '../models/body.ts';
import { folderLogoCorners } from '../models/instruments/folder.ts';
import { FINISH_ORDER, applyTransform } from '../models/mesh.ts';
import type { ModelCache } from '../models/model-cache.ts';
import { boneIndex } from '../models/rig.ts';
import { STAND_BANNER, buildStandBanners } from '../models/stage.ts';
import type { SceneLayout } from '../models/layout.ts';
import type { Vec3 } from '../models/tuples.ts';
import type { BannerTarget, FolderCovers } from './backdrop-settings.ts';
import type { PlayerSpot } from './player.ts';

/**
 * The props that carry an image of the user (design 4.5, stand banner and folder logo): a cloth
 * banner on the desks of the music stands, and a logo on the outer covers of the choir folders.
 */
export interface PropDressing {
  /** The stand banner, or `null` for none. */
  readonly stand: {
    /** The stands that carry the banner. */
    readonly target: BannerTarget;
    /** The color of the cloth, as sRGB. */
    readonly cloth: string;
    /** The color of the fringe, as sRGB, or an empty text for no fringe. */
    readonly fringe: string;
    /** The image in the middle of the banner, or `null` for a plain cloth. */
    readonly image: HTMLCanvasElement | null;
  } | null;
  /** The folder logo, or `null` for none. */
  readonly folder: {
    /** The covers that carry the logo. */
    readonly covers: FolderCovers;
    /** The logo. */
    readonly image: HTMLCanvasElement;
  } | null;
}

/** No banner and no logo. */
export const NO_PROP_DRESSING: PropDressing = { stand: null, folder: null };

/**
 * The texture of a stand banner. The left half holds the front of the cloth with the image, and
 * the right half holds the back of the cloth. The image keeps its aspect inside a box with a
 * margin, above the fringe.
 */
const BANNER_ART = {
  /** The width of one half of the texture, in pixels. */
  width: 512,
  /** The height of the texture, in pixels. */
  height: 768,
  /** The part of the height at the bottom that the fringe takes. */
  fringe: 0.12,
  /** The margin of the image box at each side, as a part of the width. */
  side: 0.1,
  /** The margin of the image box at the top, as a part of the height. */
  top: 0.08,
  /** The margin of the image box above the fringe, as a part of the height. */
  bottom: 0.05,
  /** The width of a thread of the fringe, in pixels. */
  thread: 2,
  /** The step from one thread of the fringe to the next, in pixels. */
  threadStep: 4,
  /** The brightness of the back of the cloth against its front. */
  back: 0.78,
} as const;

/** The parts of a shown layout that the props of the dressing need. */
export interface DressingParts {
  /** The layout of the scene. */
  readonly layout: SceneLayout;
  /** The player models of the score. */
  readonly models: ModelCache;
  /** The spots of the players, in the order of {@link DressingParts.players}. */
  readonly spots: readonly PlayerSpot[];
  /** The meshes of the players. */
  readonly players: readonly SkinnedMesh[];
  /** The group of the static props, which holds the banners. */
  readonly props: Object3D;
}

/**
 * Draws the texture of a stand banner.
 *
 * @param cloth The color of the cloth, as sRGB.
 * @param fringe The color of the fringe, or an empty text for none.
 * @param image The image, or `null`.
 * @returns The canvas.
 */
function drawBanner(
  cloth: string,
  fringe: string,
  image: HTMLCanvasElement | null,
): HTMLCanvasElement {
  const a = BANNER_ART;
  const canvas = document.createElement('canvas');
  canvas.width = 2 * a.width;
  canvas.height = a.height;
  const context = canvas.getContext('2d');
  if (!context) {
    return canvas;
  }
  const clothBottom = fringe ? Math.round(a.height * (1 - a.fringe)) : a.height;
  for (const [left, level] of [
    [0, 1],
    [a.width, a.back],
  ] as const) {
    context.fillStyle = cloth;
    context.fillRect(left, 0, a.width, clothBottom);
    // A soft fall of the light down the cloth, so the banner does not read as a flat card.
    const shade = context.createLinearGradient(0, 0, 0, clothBottom);
    shade.addColorStop(0, `rgba(255,255,255,${0.08 * level})`);
    shade.addColorStop(1, `rgba(0,0,0,${0.22 + (1 - level)})`);
    context.fillStyle = shade;
    context.fillRect(left, 0, a.width, clothBottom);
    if (fringe) {
      context.fillStyle = fringe;
      // The hem: a thin band of the fringe color along the lower edge of the cloth.
      context.fillRect(left, clothBottom - 4, a.width, 4);
      for (let x = left + 1; x < left + a.width; x += a.threadStep) {
        // Each thread ends at its own length, from a fixed pattern, so each build is the same.
        const fall = ((x * 37) % 11) / 11;
        const length = (a.height - clothBottom) * (0.86 + 0.14 * fall);
        context.fillRect(x, clothBottom, a.thread, Math.round(length));
      }
    }
  }
  if (image && image.width > 0 && image.height > 0) {
    const boxW = a.width * (1 - 2 * a.side);
    const boxTop = a.height * a.top;
    const boxH = clothBottom - boxTop - a.height * a.bottom;
    const scale = Math.min(boxW / image.width, boxH / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    context.drawImage(image, (a.width - w) / 2, boxTop + (boxH - h) / 2, w, h);
  }
  return canvas;
}

/**
 * Makes the texture of a canvas for the second set of texture points, `uv1`, as the printed
 * music of the sheets (`sheets.ts`).
 *
 * @param canvas The canvas.
 * @returns The texture.
 */
function decalTexture(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // The finish table of the shared material reads `uv`.
  texture.channel = 1;
  texture.anisotropy = 4;
  // The material divides by the alpha again, so a filtered edge gets no dark fringe.
  texture.premultiplyAlpha = true;
  return texture;
}

/**
 * Makes a copy of the shared material with a texture, as the sheets do (`createSheetPrint()`), so
 * the light, the pool, and the finish stay. The parts of the texture with no color are holes.
 *
 * @param shared The shared material.
 * @param map The texture.
 * @param key The key of the program.
 * @returns The material.
 */
function decalMaterial(
  shared: MeshStandardMaterial,
  map: CanvasTexture,
  key: string,
): MeshStandardMaterial {
  const material = shared.clone();
  material.map = map;
  material.alphaTest = 0.5;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -4;
  material.onBeforeCompile = (shader, renderer) => {
    shared.onBeforeCompile(shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      '#include <map_fragment>\ndiffuseColor.rgb /= max(diffuseColor.a, 1e-4);',
    );
  };
  material.customProgramCacheKey = () => `${shared.customProgramCacheKey()} ${key}`;
  return material;
}

/** The writer of the attributes of a decal: its triangles, one by one. */
class DecalTriangles {
  /** The corners, three numbers for each. */
  readonly positions: number[] = [];
  /** The normal of each corner. */
  readonly normals: number[] = [];
  /** The texture point of each corner. */
  readonly uv1: number[] = [];

  /**
   * Adds a quad as two triangles, with one normal. The corners go counterclockwise as the
   * viewer of the face sees them.
   *
   * @param corners The four corners.
   * @param uvs The texture point of each corner.
   */
  quad(
    corners: readonly [Vec3, Vec3, Vec3, Vec3],
    uvs: readonly [number, number, number, number, number, number, number, number],
  ): void {
    const [a, b, , d] = corners;
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]] as const;
    const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]] as const;
    const n = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ];
    const length = Math.hypot(n[0] ?? 0, n[1] ?? 0, n[2] ?? 0) || 1;
    for (const k of [0, 1, 2, 0, 2, 3]) {
      this.positions.push(...corners[k]!);
      this.normals.push((n[0] ?? 0) / length, (n[1] ?? 0) / length, (n[2] ?? 0) / length);
      this.uv1.push(uvs[k * 2] ?? 0, uvs[k * 2 + 1] ?? 0);
    }
  }

  /**
   * Makes the geometry, with white colors and the finish `matte`.
   *
   * @returns The geometry.
   */
  build(): BufferGeometry {
    const count = this.positions.length / 3;
    const finish = (FINISH_ORDER.indexOf('matte') + 0.5) / FINISH_ORDER.length;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setAttribute('normal', new BufferAttribute(new Float32Array(this.normals), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(count * 3).fill(1), 3));
    geometry.setAttribute(
      'uv',
      new BufferAttribute(
        new Float32Array(count * 2).map((_, i) => (i % 2 === 0 ? finish : 0.5)),
        2,
      ),
    );
    geometry.setAttribute('uv1', new BufferAttribute(new Float32Array(this.uv1), 2));
    return geometry;
  }
}

/**
 * Gives a corner of the banner rows of `buildStandBanners()`.
 *
 * @param rows The rows.
 * @param banner The banner.
 * @param corner The corner, from 0 to 5.
 * @returns The point.
 */
function rowPoint(rows: Float32Array, banner: number, corner: number): Vec3 {
  const o = banner * 18 + corner * 3;
  return [rows[o] ?? 0, rows[o + 1] ?? 0, rows[o + 2] ?? 0];
}

/**
 * Creates the mesh of the stand banners of a layout. The front of the cloth faces away from the
 * reader of each stand, and the back of the cloth faces the reader.
 *
 * @param layout The layout.
 * @param target The stands that carry a banner.
 * @param map The texture of {@link drawBanner}.
 * @param shared The shared material.
 * @returns The mesh, or `null` with no stand.
 */
function createBannerMesh(
  layout: SceneLayout,
  target: BannerTarget,
  map: CanvasTexture,
  shared: MeshStandardMaterial,
): Mesh | null {
  const rows = buildStandBanners(layout, {
    conductor: target !== 'players',
    players: target !== 'conductor',
  });
  const count = rows.length / 18;
  if (count === 0) {
    return null;
  }
  const list = new DecalTriangles();
  for (let i = 0; i < count; i++) {
    const bl = rowPoint(rows, i, 0);
    const br = rowPoint(rows, i, 1);
    const el = rowPoint(rows, i, 2);
    const er = rowPoint(rows, i, 3);
    const ll = rowPoint(rows, i, 4);
    const lr = rowPoint(rows, i, 5);
    const hang = Math.hypot(el[0] - bl[0], el[1] - bl[1], el[2] - bl[2]);
    const lip = Math.hypot(ll[0] - el[0], ll[1] - el[1], ll[2] - el[2]) + STAND_BANNER.gap;
    const v = hang / (hang + lip);
    list.quad([bl, br, er, el], [0, 0, 0.5, 0, 0.5, v, 0, v]);
    list.quad([el, er, lr, ll], [0, v, 0.5, v, 0.5, 1, 0, 1]);
    // The back of the cloth: the same corners in the other turn, on the right half.
    list.quad([br, bl, el, er], [0.5, 0, 1, 0, 1, v, 0.5, v]);
    list.quad([er, el, ll, lr], [0.5, v, 1, v, 1, 1, 0.5, 1]);
  }
  const mesh = new Mesh(list.build(), decalMaterial(shared, map, 'banner'));
  mesh.name = 'stand-banners';
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Creates the logo of the folder of one singer: a skinned mesh on the skeleton of the singer,
 * on the bone of the folder, so the logo moves with the folder.
 *
 * @param player The mesh of the singer.
 * @param spot The spot of the singer.
 * @param models The player models.
 * @param covers The covers that carry the logo.
 * @param aspect The height over the width of the logo.
 * @param material The material of the logo.
 * @returns The mesh, or `null` for a player with no folder.
 */
function createFolderLogo(
  player: SkinnedMesh,
  spot: PlayerSpot,
  models: ModelCache,
  covers: FolderCovers,
  aspect: number,
  material: MeshStandardMaterial,
): SkinnedMesh | null {
  if (spot.instrument !== 'choir-folder') {
    return null;
  }
  const model = models.get(spot.species, spot.instrument, spot.kettles, spot.support);
  const placed = model.pieces.find((piece) => piece.piece.bone === 'instrument');
  if (!placed) {
    return null;
  }
  const list = new DecalTriangles();
  const sides: readonly (-1 | 1)[] = covers === 'both' ? [-1, 1] : [-1];
  for (const side of sides) {
    const [a, b, c, d] = folderLogoCorners(side, aspect);
    const at = (p: Vec3): Vec3 => applyTransform(placed.at, p);
    list.quad([at(a), at(b), at(c), at(d)], [0, 0, 1, 0, 1, 1, 0, 1]);
  }
  const geometry = list.build();
  const count = geometry.getAttribute('position').count;
  const joint = playerJoint(boneIndex('instrument'));
  const joints = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let v = 0; v < count; v++) {
    joints[v * 4] = joint;
    weights[v * 4] = 1;
  }
  geometry.setAttribute('skinIndex', new BufferAttribute(joints, 4));
  geometry.setAttribute('skinWeight', new BufferAttribute(weights, 4));
  const logo = new SkinnedMesh(geometry, material);
  logo.name = 'folder-logo';
  logo.frustumCulled = false;
  logo.receiveShadow = true;
  logo.bind(player.skeleton, player.bindMatrix);
  return logo;
}

/**
 * The banners and the logos of a dressing on the shown layout (design 4.5). It keeps the
 * textures from build to build, and makes them again only for a new dressing.
 */
export class PropDecor {
  /** The shared material, which the copies of the decals start from. */
  readonly #shared: MeshStandardMaterial;
  /** The dressing of the textures. */
  #dressing: PropDressing = NO_PROP_DRESSING;
  /** The texture of the stand banner, or `null` for none. */
  #bannerMap: CanvasTexture | null = null;
  /** The texture of the folder logo, or `null` for none. */
  #logoMap: CanvasTexture | null = null;

  /**
   * Creates the decor with no dressing.
   *
   * @param shared The shared material.
   */
  constructor(shared: MeshStandardMaterial) {
    this.#shared = shared;
  }

  /**
   * Sets the dressing, and makes its textures. The objects of the layouts do not change:
   * {@link PropDecor.attach} adds them.
   *
   * @param dressing The dressing.
   */
  set(dressing: PropDressing): void {
    if (dressing === this.#dressing) {
      return;
    }
    this.#dressing = dressing;
    this.#bannerMap?.dispose();
    this.#logoMap?.dispose();
    this.#bannerMap = dressing.stand
      ? decalTexture(drawBanner(dressing.stand.cloth, dressing.stand.fringe, dressing.stand.image))
      : null;
    this.#logoMap = dressing.folder ? decalTexture(dressing.folder.image) : null;
  }

  /**
   * Adds the banners and the logos of the dressing to a layout.
   *
   * @param parts The parts of the layout.
   * @returns The new objects, for {@link PropDecor.detach}.
   */
  attach(parts: DressingParts): Object3D[] {
    const objects: Object3D[] = [];
    const { stand, folder } = this.#dressing;
    if (stand && this.#bannerMap) {
      const banners = createBannerMesh(parts.layout, stand.target, this.#bannerMap, this.#shared);
      if (banners) {
        parts.props.add(banners);
        banners.updateMatrixWorld(true);
        objects.push(banners);
      }
    }
    if (folder && this.#logoMap) {
      const material = decalMaterial(this.#shared, this.#logoMap, 'logo');
      const aspect = folder.image.height / Math.max(1, folder.image.width);
      let used = false;
      for (const [i, player] of parts.players.entries()) {
        const spot = parts.spots[i];
        const logo = spot
          ? createFolderLogo(player, spot, parts.models, folder.covers, aspect, material)
          : null;
        if (logo) {
          player.add(logo);
          logo.updateMatrixWorld(true);
          objects.push(logo);
          used = true;
        }
      }
      if (!used) {
        material.dispose();
      }
    }
    return objects;
  }

  /**
   * Removes the objects of {@link PropDecor.attach} and frees their geometries and materials.
   * The textures stay.
   *
   * @param objects The objects.
   */
  static detach(objects: readonly Object3D[]): void {
    const materials = new Set<{ dispose(): void }>();
    for (const object of objects) {
      object.removeFromParent();
      if (object instanceof Mesh) {
        object.geometry.dispose();
        if (!Array.isArray(object.material)) {
          materials.add(object.material);
        }
      }
    }
    for (const material of materials) {
      material.dispose();
    }
  }
}
