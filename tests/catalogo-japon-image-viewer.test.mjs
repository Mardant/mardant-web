import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogImageCandidates } from '../js/japan-image-viewer.js';

test('Mercari thumbnails prefer the original and retain their timestamp and fallback', () => {
  assert.deepEqual(catalogImageCandidates('https://static.mercdn.net/thumb/item/webp/m88075138165_1.jpg?1791003547'), [
    'https://static.mercdn.net/item/detail/orig/photos/m88075138165_1.jpg?1791003547',
    'https://static.mercdn.net/thumb/item/webp/m88075138165_1.jpg?1791003547'
  ]);
});
test('Existing originals are requested only once', () => {
  const url = 'https://static.mercdn.net/item/detail/orig/photos/m72890348120_1.jpg?1774687463';
  assert.deepEqual(catalogImageCandidates(url), [url]);
});
test('Other shops and unknown Mercari paths retain their actual URL', () => {
  for (const url of ['https://m.media-amazon.com/images/I/example.jpg', 'https://static.mercdn.net/other/photo.jpg', 'https://static.mercdn.net.example.test/thumb/item/webp/m123_1.jpg']) {
    assert.deepEqual(catalogImageCandidates(url), [url]);
  }
});
test('Empty, malformed and executable URLs never enter the viewer', () => {
  for (const value of ['', null, 'https://[invalid', 'javascript:alert(1)', 'data:text/html,test', 'file:///C:/private.jpg']) {
    assert.deepEqual(catalogImageCandidates(value), []);
  }
});
test('Recognized numbered photos retain the same product and photo number', () => {
  assert.equal(catalogImageCandidates('https://static.mercdn.net/thumb/item/webp/m123456_12.jpg')[0],
    'https://static.mercdn.net/item/detail/orig/photos/m123456_12.jpg');
});
