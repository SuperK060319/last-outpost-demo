export const FONT_BODY = 'Microsoft YaHei, PingFang SC, sans-serif';
export const FONT_DISPLAY = 'Bahnschrift Condensed, Arial Narrow, Microsoft YaHei, sans-serif';

export function addButton(scene, x, y, width, height, label, onClick, options = {}) {
  const fill = options.fill ?? 0x30383a;
  const stroke = options.stroke ?? 0xe67932;
  const panel = scene.add.rectangle(x, y, width, height, fill, options.alpha ?? 0.96)
    .setStrokeStyle(1.5, stroke, 0.88)
    .setInteractive({ useHandCursor: true });
  const text = scene.add.text(x, y, label, {
    fontFamily: options.fontFamily || FONT_DISPLAY,
    fontSize: options.fontSize || '18px',
    fontStyle: options.fontStyle || 'bold',
    color: options.color || '#f1eadc',
    align: 'center',
    letterSpacing: options.letterSpacing ?? 0.35,
  }).setOrigin(0.5);

  panel.on('pointerover', () => panel.setFillStyle(options.hoverFill ?? 0x4e5b3a, 1));
  panel.on('pointerout', () => panel.setFillStyle(fill, options.alpha ?? 0.96));
  panel.on('pointerdown', () => scene.tweens.add({ targets: [panel, text], scale: 0.97, duration: 55, yoyo: true }));
  panel.on('pointerup', onClick);
  return { panel, text, setLabel: (value) => text.setText(value), setEnabled(enabled) {
    panel.disableInteractive();
    if (enabled) panel.setInteractive({ useHandCursor: true });
    panel.setAlpha(enabled ? 1 : 0.44);
    text.setAlpha(enabled ? 1 : 0.52);
  } };
}

export function addPaperPanel(scene, x, y, width, height, depth = 1) {
  return scene.add.rectangle(x, y, width, height, 0x0b2229, 0.94)
    .setStrokeStyle(1, 0x8fc7aa, 0.38)
    .setDepth(depth);
}

export function addMist(scene, count = 20) {
  for (let i = 0; i < count; i += 1) {
    const mote = scene.add.circle((i * 97) % 540, 90 + ((i * 149) % 790), 1 + (i % 3), 0xb9f1ce, 0.06 + (i % 4) * 0.025);
    scene.tweens.add({ targets: mote, x: mote.x + 18 + (i % 5) * 6, y: mote.y - 26, alpha: 0.22, duration: 2600 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }
}
