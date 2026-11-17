/* v0.11.2 画像を追加するときはこのファイルで対応付けます。
 * ID paper は表示名を変更しても固定です。
 * D1 / Worker のゲーム状態は変更しません。 */
window.KAGARISO_VISUALS = Object.freeze({
  backgrounds: Object.freeze({
    hall: 'images/backgrounds/hall.png',
    cave: 'images/backgrounds/cave.png',
    sections: Object.freeze({
      1: 'images/backgrounds/cave1.png',
      2: 'images/backgrounds/cave2.png',
      3: 'images/backgrounds/cave3.png',
      4: 'images/backgrounds/cave4.png',
      5: 'images/backgrounds/cave5.png'
    })
  }),
  npcs: Object.freeze({
    paper: Object.freeze({
      name: '黄色い獣',
      base: 'images/npc/paper/',
      expressions: Object.freeze({
        normal:'normal.png',happy:'happy.png',laugh:'laugh.png',
        angry:'angry.png',rage:'rage.png',sad:'sad.png',sulk:'sulk.png',
        sleepy:'sleepy.png',sleeping:'sleeping.png',scary:'scary.png',
        shy:'shy.png',sing:'sing.png',pride:'pride.png',
        back:'back.png',stand:'stand up.png',stir:'stir.png',
        full:'full stomach.png',haint:'haint.png'
      })
    })
  })
});
