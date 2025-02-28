import { Resource, TextureManager, TextureUniform } from "../../../index.js";
import TextureMinificationFilter from "../../../Source/Renderer/TextureMinificationFilter.js";
import createScene from "../../../../../Specs/createScene.js";
import pollToPromise from "../../../../../Specs/pollToPromise.js";

describe(
  "Scene/Model/TextureManager",
  function () {
    let sceneWithWebgl1;
    let sceneWithWebgl2;

    beforeAll(function () {
      sceneWithWebgl1 = createScene();
      sceneWithWebgl2 = createScene({
        contextOptions: { requestWebgl2: true },
      });
    });

    afterAll(function () {
      sceneWithWebgl1.destroyForSpecs();
      sceneWithWebgl2.destroyForSpecs();
    });

    const textureManagers = [];
    afterEach(function () {
      for (let i = 0; i < textureManagers.length; i++) {
        const textureManager = textureManagers[i];
        if (!textureManager.isDestroyed()) {
          textureManager.destroy();
        }
      }
      textureManagers.length = 0;
    });

    function waitForTextureLoad(textureManager, textureId, webgl2) {
      const scene = webgl2 ? sceneWithWebgl2 : sceneWithWebgl1;

      const oldValue = textureManager.getTexture(textureId);
      return pollToPromise(function () {
        scene.renderForSpecs();
        textureManager.update(scene.frameState);

        // Checking that the texture changed allows the waitForTextureLoad()
        // to be called multiple times in one promise chain.
        return textureManager.getTexture(textureId) !== oldValue;
      }).then(function () {
        return textureManager.getTexture(textureId);
      });
    }

    const blueUrl = "Data/Images/Blue2x2.png";
    const greenUrl = "Data/Images/Green1x4.png";
    const redUrl = "Data/Images/Red16x16.png";
    const blue10x10Url = "Data/Images/Blue10x10.png";

    it("constructs", function () {
      const textureManager = new TextureManager();
      textureManagers.push(textureManager);
      expect(textureManager._textures).toEqual({});
      expect(textureManager._loadedImages).toEqual([]);
    });

    it("loads texture from a URL", function () {
      const textureManager = new TextureManager();
      textureManagers.push(textureManager);
      const id = "testTexture";

      textureManager.loadTexture2D(
        id,
        new TextureUniform({
          url: blueUrl,
        })
      );

      return waitForTextureLoad(textureManager, id).then(function (texture) {
        expect(texture.width).toBe(2);
        expect(texture.height).toBe(2);
      });
    });

    it("loads texture from a typed array", function () {
      const textureManager = new TextureManager();
      textureManagers.push(textureManager);
      const id = "testTexture";

      textureManager.loadTexture2D(
        id,
        new TextureUniform({
          typedArray: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
          width: 1,
          height: 2,
        })
      );

      return waitForTextureLoad(textureManager, id).then(function (texture) {
        expect(texture.width).toBe(1);
        expect(texture.height).toBe(2);
      });
    });

    it("generates mipmaps when sampler type requires them", function () {
      const textureManager = new TextureManager();
      textureManagers.push(textureManager);
      const id = "testTexture";

      textureManager.loadTexture2D(
        id,
        new TextureUniform({
          url: redUrl,
          minificationFilter: TextureMinificationFilter.LINEAR_MIPMAP_LINEAR,
        })
      );

      return waitForTextureLoad(textureManager, id).then(function (texture) {
        expect(texture._hasMipmap).toBe(true);
      });
    });

    it("resizes image to power-of-two dimensions if needed", function () {
      const textureManager = new TextureManager();
      textureManagers.push(textureManager);
      const id = "testTexture";

      textureManager.loadTexture2D(
        id,
        new TextureUniform({
          url: blue10x10Url,
          minificationFilter: TextureMinificationFilter.LINEAR_MIPMAP_NEAREST,
        })
      );

      return waitForTextureLoad(textureManager, id).then(function (texture) {
        expect(texture.width).toBe(16);
        expect(texture.height).toBe(16);
        expect(texture._hasMipmap).toBe(true);
      });
    });

    it("can resize a texture supplied as a Uint8Array", function () {
      const redPixels3x3 = Array(9).fill([255, 0, 0, 255]).flat();
      const uint8array3x3 = new Uint8Array(redPixels3x3);

      const textureUniform = new TextureUniform({
        typedArray: uint8array3x3,
        width: 3,
        height: 3,
        minificationFilter: TextureMinificationFilter.NEAREST_MIPMAP_LINEAR,
      });

      const textureManager = new TextureManager();
      textureManagers.push(textureManager);
      const id = "testTexture";

      textureManager.loadTexture2D(id, textureUniform);

      return waitForTextureLoad(textureManager, id).then(function (texture) {
        expect(texture.width).toBe(4);
        expect(texture.height).toBe(4);
        expect(texture._hasMipmap).toBe(true);
      });
    });

    it("generates mipmaps without resizing in WebGL2", function () {
      if (!sceneWithWebgl2.context.webgl2) {
        return;
      }

      const textureManager = new TextureManager();
      textureManagers.push(textureManager);
      const id = "testTexture";

      textureManager.loadTexture2D(
        id,
        new TextureUniform({
          url: blue10x10Url,
          minificationFilter: TextureMinificationFilter.NEAREST_MIPMAP_NEAREST,
        })
      );

      const webgl2 = true;

      return waitForTextureLoad(textureManager, id, webgl2).then(function (
        texture
      ) {
        expect(texture.width).toBe(10);
        expect(texture.height).toBe(10);
        expect(texture._hasMipmap).toBe(true);
      });
    });

    it("destroys old texture before adding a new one", function () {
      const textureManager = new TextureManager();
      textureManagers.push(textureManager);
      const id = "testTexture";

      textureManager.loadTexture2D(
        id,
        new TextureUniform({
          url: blueUrl,
        })
      );

      return waitForTextureLoad(textureManager, id).then(function (
        blueTexture
      ) {
        expect(blueTexture.width).toBe(2);
        expect(blueTexture.height).toBe(2);
        expect(blueTexture.isDestroyed()).toBe(false);

        textureManager.loadTexture2D(
          id,
          new TextureUniform({
            url: greenUrl,
          })
        );
        return waitForTextureLoad(textureManager, id).then(function (
          greenTexture
        ) {
          expect(blueTexture.isDestroyed()).toBe(true);
          expect(greenTexture.width).toBe(1);
          expect(greenTexture.height).toBe(4);
          expect(greenTexture.isDestroyed()).toBe(false);
        });
      });
    });

    it("getTexture returns undefined for unknown texture", function () {
      const textureManager = new TextureManager();
      textureManagers.push(textureManager);
      const texture = textureManager.getTexture("notATexture");
      expect(texture).not.toBeDefined();
    });

    it("sets a defaultTexture on error", function () {
      spyOn(Resource.prototype, "fetchImage").and.callFake(function () {
        return Promise.reject();
      });
      const textureManager = new TextureManager();
      textureManagers.push(textureManager);
      const id = "testTexture";

      // Call update first to ensure the default texture is available
      // when the fetchImage() call rejects
      textureManager.update(sceneWithWebgl1.frameState);
      textureManager.loadTexture2D(
        id,
        new TextureUniform({
          url: "https://example.com/not-a-texture.jpg",
        })
      );
      return waitForTextureLoad(textureManager, id)
        .then(function (texture) {
          const defaultTexture =
            sceneWithWebgl1.frameState.context.defaultTexture;
          expect(texture).toBe(defaultTexture);
        })
        .catch(console.error);
    });

    it("destroys", function () {
      const textureManager = new TextureManager();
      textureManagers.push(textureManager);
      const id = "testTexture";

      textureManager.loadTexture2D(
        id,
        new TextureUniform({
          url: blueUrl,
        })
      );

      return waitForTextureLoad(textureManager, id).then(function (texture) {
        expect(textureManager.isDestroyed()).toBe(false);
        expect(texture.isDestroyed()).toBe(false);

        textureManager.destroy();
        expect(textureManager.isDestroyed()).toBe(true);
        expect(texture.isDestroyed()).toBe(true);
      });
    });
  },
  "WebGL"
);
