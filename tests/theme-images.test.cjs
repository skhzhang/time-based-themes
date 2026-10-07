const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

test('system-theme detection reapplies image themes without passing rejected moz-extension URLs', async () => {
    const header = 'moz-extension://theme-uuid/header.png';
    const background = 'moz-extension://theme-uuid/background.png';
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
    const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
    const theme = {
        colors: {frame: '#eeeeee', tab_background_text: '#111111'},
        images: {theme_frame: header, additional_backgrounds: [background]},
        properties: {color_scheme: 'light'}
    };
    const updates = [];
    const fetches = [];
    const errors = [];
    const browser = {
        storage: {
            local: {get: async () => ({autodarkchangeMode: {mode: 'system-theme'}})},
            onChanged: {addListener() {}}
        },
        theme: {
            reset: async () => {},
            getCurrent: async () => structuredClone(theme),
            async update(details) {
                // Firefox accepts relative paths or PNG/JPEG data URLs, not
                // the absolute moz-extension URLs returned by getCurrent().
                for (const image of Object.values(details.images).flat()) {
                    const acceptedDataUrl = image.startsWith('data:image/png;base64,')
                        || image.startsWith('data:image/jpeg;base64,');
                    if (!acceptedDataUrl && /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(image)) {
                        throw new Error('theme.update rejected an absolute image URL');
                    }
                }
                updates.push(details);
            }
        }
    };
    const context = vm.createContext({
        browser,
        console: {log: (message) => errors.push(message)},
        fetch: async (url) => {
            assert.ok([header, background].includes(url));
            fetches.push(url);
            return {ok: true, blob: async () => new Blob([png], {type: 'image/png'})};
        },
        FileReader: class {
            readAsDataURL(blob) {
                blob.arrayBuffer().then((bytes) => {
                    this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;
                    this.onload();
                });
            }
        }
    });
    for (const file of ['utils.js', 'common.js']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
    }

    // Reproduce the reported validation failure before exercising the fix.
    await assert.rejects(browser.theme.update(theme), /rejected an absolute image URL/);
    context.detect_scheme_change_block = true;
    await context.enableSchemeChangeDetection();

    assert.deepEqual(errors, []);
    assert.equal(updates.length, 1);
    assert.deepEqual(fetches, [header, background]);
    assert.equal(updates[0].images.theme_frame, dataUrl);
    assert.equal(updates[0].images.additional_backgrounds[0], dataUrl);
    assert.deepEqual(updates[0].colors, theme.colors);
    assert.equal(updates[0].properties.color_scheme, 'system');
    assert.equal(updates[0].properties.content_color_scheme, 'system');
    assert.equal(context.detect_scheme_change_block, false);
    assert.equal(theme.images.theme_frame, header);
});
