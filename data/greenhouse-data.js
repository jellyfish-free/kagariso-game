window.KAGARISO_GREENHOUSE = {
  "version": "0.19.0",
  "background": "images/backgrounds/greenhouse.webp",
  "event": {
    "id": "lent_greenhouse_reward",
    "requiredFlowers": 1000,
    "oncePerResident": true,
    "seedReward": {
      "id": "LENT_SEED",
      "quantity": 1
    },
    "wateringCanPool": [
      "GH_CAN_R",
      "GH_CAN_B",
      "GH_CAN_Y",
      "GH_CAN_G"
    ],
    "dialogue": [
      "…へぇ、頼んだものを揃えてくれたんだ。少しはやるじゃん。",
      "品の状態も悪くないし、約束もきちんと守るようだし、取引相手としては合格ってところかな",
      "これ、報酬。この種とじょうろを持っていっていいよ。何が育つかは、実際に育ててからのお楽しみ。種だけ渡しても持て余すだろうから栽培に使える場所も特別に用意しておいたよ。好きに使って",
      "そこで育ったものを持ってくれば取引材料にしてあげるよ",
      "ごひいきに♡"
    ]
  },
  "growing": {
    "pots": 5,
    "seedsPerBag": 5,
    "seedItemId": "LENT_SEED",
    "normalSeconds": 600,
    "compostSeconds": 300,
    "compostItemId": "S0047",
    "fertilizerItemId": "GH_FERTILIZER",
    "normalYield": [
      1,
      2,
      3
    ],
    "fertilizedYield": 5,
    "allowCombination": true,
    "harvestExpiry": null,
    "flowerPool": [
      {
        "id": "GH_FLOWER_GREEN",
        "weight": 1
      },
      {
        "id": "GH_FLOWER_RED",
        "weight": 1
      },
      {
        "id": "GH_FLOWER_WHITE",
        "weight": 1
      },
      {
        "id": "GH_FLOWER_YELLOW",
        "weight": 1
      },
      {
        "id": "GH_FLOWER_BLACK",
        "weight": 1
      },
      {
        "id": "GH_FLOWER_BLUE",
        "weight": 1
      },
      {
        "id": "GH_FLOWER_SILK",
        "weight": 1
      },
      {
        "id": "GH_FLOWER_COTTON",
        "weight": 1
      }
    ],
    "yieldPerPot": true,
    "allPotsBloom": true
  },
  "items": [
    {
      "id": "LENT_SEED",
      "name": "不思議な花の種",
      "category": "園芸用品",
      "image": "images/greenhouse/tane2.webp",
      "description": "1袋に5粒入った種。何が育つかはお楽しみ。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_FERTILIZER",
      "name": "肥料",
      "category": "園芸用品",
      "image": "images/greenhouse/fertilizer.webp",
      "description": "5株すべての開花を確定させる。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_CAN_R",
      "name": "ゾウさんのじょうろ（赤）",
      "category": "園芸道具",
      "image": "images/greenhouse/growing/jouroR.webp",
      "description": "繰り返し使えるじょうろ。色は変更できない。",
      "source": "初回イベント",
      "rarity": null,
      "transferable": false
    },
    {
      "id": "GH_CAN_B",
      "name": "ゾウさんのじょうろ（青）",
      "category": "園芸道具",
      "image": "images/greenhouse/growing/jouroB.webp",
      "description": "繰り返し使えるじょうろ。色は変更できない。",
      "source": "初回イベント",
      "rarity": null,
      "transferable": false
    },
    {
      "id": "GH_CAN_Y",
      "name": "ゾウさんのじょうろ（黄）",
      "category": "園芸道具",
      "image": "images/greenhouse/growing/jouroY.webp",
      "description": "繰り返し使えるじょうろ。色は変更できない。",
      "source": "初回イベント",
      "rarity": null,
      "transferable": false
    },
    {
      "id": "GH_CAN_G",
      "name": "ゾウさんのじょうろ（緑）",
      "category": "園芸道具",
      "image": "images/greenhouse/growing/jouroG.webp",
      "description": "繰り返し使えるじょうろ。色は変更できない。",
      "source": "初回イベント",
      "rarity": null,
      "transferable": false
    },
    {
      "id": "GH_FLOWER_GREEN",
      "name": "緑の花",
      "category": "温室の花",
      "image": "images/greenhouse/flowerGreen.webp",
      "description": "温室で育てた緑の花。",
      "source": "温室",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_FLOWER_RED",
      "name": "赤の花",
      "category": "温室の花",
      "image": "images/greenhouse/flowerRed.webp",
      "description": "温室で育てた赤の花。",
      "source": "温室",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_FLOWER_WHITE",
      "name": "白の花",
      "category": "温室の花",
      "image": "images/greenhouse/flowerWhite.webp",
      "description": "温室で育てた白の花。",
      "source": "温室",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_FLOWER_YELLOW",
      "name": "黄色の花",
      "category": "温室の花",
      "image": "images/greenhouse/flowerYellow.webp",
      "description": "温室で育てた黄色の花。",
      "source": "温室",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_FLOWER_BLACK",
      "name": "黒の花",
      "category": "温室の花",
      "image": "images/greenhouse/flowerBlack.webp",
      "description": "温室で育てた黒の花。",
      "source": "温室",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_FLOWER_BLUE",
      "name": "青の花",
      "category": "温室の花",
      "image": "images/greenhouse/flowerBlue.webp",
      "description": "温室で育てた青の花。",
      "source": "温室",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_FLOWER_SILK",
      "name": "糸を吐く花",
      "category": "温室の花",
      "image": "images/greenhouse/silkworm.webp",
      "description": "温室で育てた糸を吐く花。",
      "source": "温室",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_FLOWER_COTTON",
      "name": "綿花",
      "category": "温室の花",
      "image": "images/greenhouse/cotton.webp",
      "description": "温室で育てた綿花。",
      "source": "温室",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_DYE_RED",
      "name": "赤の染料",
      "category": "染料",
      "image": "images/items/dyes/dye_red.webp",
      "description": "花から作られた染料。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_DYE_BLUE",
      "name": "青の染料",
      "category": "染料",
      "image": "images/items/dyes/dye_blue.webp",
      "description": "花から作られた染料。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_DYE_YELLOW",
      "name": "黄の染料",
      "category": "染料",
      "image": "images/items/dyes/dye_yellow.webp",
      "description": "花から作られた染料。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_DYE_GREEN",
      "name": "緑の染料",
      "category": "染料",
      "image": "images/items/dyes/dye_green.webp",
      "description": "花から作られた染料。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_DYE_PINK",
      "name": "ピンクの染料",
      "category": "染料",
      "image": "images/items/dyes/dye_pink.webp",
      "description": "花から作られた染料。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_DYE_PURPLE",
      "name": "紫の染料",
      "category": "染料",
      "image": "images/items/dyes/dye_purple.webp",
      "description": "花から作られた染料。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_DYE_LIGHT_BLUE",
      "name": "水色の染料",
      "category": "染料",
      "image": "images/items/dyes/dye_light_blue.webp",
      "description": "花から作られた染料。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_DYE_ORANGE",
      "name": "オレンジの染料",
      "category": "染料",
      "image": "images/items/dyes/dye_orange.webp",
      "description": "花から作られた染料。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_DYE_LIME",
      "name": "黄緑の染料",
      "category": "染料",
      "image": "images/items/dyes/dye_lime.webp",
      "description": "花から作られた染料。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_DYE_WHITE",
      "name": "白の染料",
      "category": "染料",
      "image": "images/items/dyes/dye_white.webp",
      "description": "花から作られた染料。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_DYE_BLACK",
      "name": "黒の染料",
      "category": "染料",
      "image": "images/items/dyes/dye_black.webp",
      "description": "花から作られた染料。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_DYE_GRAY",
      "name": "灰色の染料",
      "category": "染料",
      "image": "images/items/dyes/dye_gray.webp",
      "description": "花から作られた染料。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_SILK_FABRIC",
      "name": "シルク生地",
      "category": "生地",
      "image": "images/greenhouse/silkFabric.webp",
      "description": "商人との交換で手に入るシルク生地。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_COTTON_FABRIC",
      "name": "コットン生地",
      "category": "生地",
      "image": "images/greenhouse/cottonFabric.webp",
      "description": "商人との交換で手に入るコットン生地。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_LINEN_FABRIC",
      "name": "リネン生地",
      "category": "生地",
      "image": "images/greenhouse/linenFabric.webp",
      "description": "商人との交換で手に入るリネン生地。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_BOA_FABRIC",
      "name": "ボア生地",
      "category": "生地",
      "image": "images/greenhouse/biaFabric.webp",
      "description": "商人との交換で手に入るボア生地。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_THREAD",
      "name": "糸",
      "category": "裁縫素材",
      "image": "images/greenhouse/thread.webp",
      "description": "商人との交換で手に入る糸。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_BUTTON",
      "name": "ボタン",
      "category": "裁縫素材",
      "image": "images/greenhouse/button.webp",
      "description": "商人との交換で手に入るボタン。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    },
    {
      "id": "GH_STRING",
      "name": "紐",
      "category": "裁縫素材",
      "image": "images/greenhouse/string.webp",
      "description": "商人との交換で手に入る紐。",
      "source": "商人との交換",
      "rarity": null,
      "transferable": true
    }
  ],
  "recipes": [
    {
      "id": "dye_red",
      "category": "染料",
      "result": {
        "id": "GH_DYE_RED",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "GH_FLOWER_RED",
            "quantity": 1
          },
          {
            "id": "S0006",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "dye_blue",
      "category": "染料",
      "result": {
        "id": "GH_DYE_BLUE",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "GH_FLOWER_BLUE",
            "quantity": 1
          },
          {
            "id": "S0006",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "dye_yellow",
      "category": "染料",
      "result": {
        "id": "GH_DYE_YELLOW",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "GH_FLOWER_YELLOW",
            "quantity": 1
          },
          {
            "id": "S0006",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "dye_green",
      "category": "染料",
      "result": {
        "id": "GH_DYE_GREEN",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "GH_FLOWER_GREEN",
            "quantity": 1
          },
          {
            "id": "S0006",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "dye_pink",
      "category": "染料",
      "result": {
        "id": "GH_DYE_PINK",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "GH_FLOWER_RED",
            "quantity": 1
          },
          {
            "id": "GH_FLOWER_WHITE",
            "quantity": 1
          },
          {
            "id": "S0006",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "dye_purple",
      "category": "染料",
      "result": {
        "id": "GH_DYE_PURPLE",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "GH_FLOWER_RED",
            "quantity": 1
          },
          {
            "id": "GH_FLOWER_BLUE",
            "quantity": 1
          },
          {
            "id": "S0006",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "dye_light_blue",
      "category": "染料",
      "result": {
        "id": "GH_DYE_LIGHT_BLUE",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "GH_FLOWER_BLUE",
            "quantity": 1
          },
          {
            "id": "GH_FLOWER_WHITE",
            "quantity": 1
          },
          {
            "id": "S0006",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "dye_orange",
      "category": "染料",
      "result": {
        "id": "GH_DYE_ORANGE",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "GH_FLOWER_RED",
            "quantity": 1
          },
          {
            "id": "GH_FLOWER_YELLOW",
            "quantity": 1
          },
          {
            "id": "S0006",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "dye_lime",
      "category": "染料",
      "result": {
        "id": "GH_DYE_LIME",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "GH_FLOWER_GREEN",
            "quantity": 1
          },
          {
            "id": "GH_FLOWER_YELLOW",
            "quantity": 1
          },
          {
            "id": "S0006",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "dye_white",
      "category": "染料",
      "result": {
        "id": "GH_DYE_WHITE",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "GH_FLOWER_WHITE",
            "quantity": 1
          },
          {
            "id": "S0006",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "dye_black",
      "category": "染料",
      "result": {
        "id": "GH_DYE_BLACK",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "GH_FLOWER_BLACK",
            "quantity": 1
          },
          {
            "id": "S0006",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "dye_gray",
      "category": "染料",
      "result": {
        "id": "GH_DYE_GRAY",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "GH_FLOWER_BLACK",
            "quantity": 1
          },
          {
            "id": "GH_FLOWER_WHITE",
            "quantity": 1
          },
          {
            "id": "S0006",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "silk_fabric",
      "category": "生地",
      "result": {
        "id": "GH_SILK_FABRIC",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "GH_FLOWER_SILK",
            "quantity": 3
          }
        ]
      ]
    },
    {
      "id": "cotton_fabric",
      "category": "生地",
      "result": {
        "id": "GH_COTTON_FABRIC",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "GH_FLOWER_COTTON",
            "quantity": 3
          }
        ]
      ]
    },
    {
      "id": "linen_fabric",
      "category": "生地",
      "result": {
        "id": "GH_LINEN_FABRIC",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "C028",
            "quantity": 2
          }
        ],
        [
          {
            "id": "C030",
            "quantity": 5
          }
        ]
      ]
    },
    {
      "id": "boa_fabric",
      "category": "生地",
      "result": {
        "id": "GH_BOA_FABRIC",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "S0060",
            "quantity": 3
          }
        ],
        [
          {
            "id": "C018",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "thread",
      "category": "裁縫素材",
      "result": {
        "id": "GH_THREAD",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "GH_FLOWER_SILK",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "button",
      "category": "裁縫素材",
      "result": {
        "id": "GH_BUTTON",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "S0050",
            "quantity": 1
          }
        ],
        [
          {
            "id": "S0112",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "string",
      "category": "裁縫素材",
      "result": {
        "id": "GH_STRING",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "C030",
            "quantity": 1
          }
        ],
        [
          {
            "id": "C029",
            "quantity": 1
          }
        ]
      ]
    },
    {
      "id": "seed",
      "category": "園芸用品",
      "result": {
        "id": "LENT_SEED",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "S0004",
            "quantity": 2
          }
        ],
        [
          {
            "id": "S0004",
            "quantity": 1
          },
          {
            "id": "S0005",
            "quantity": 1
          }
        ],
        [
          {
            "id": "S0004",
            "quantity": 1
          },
          {
            "id": "S0046",
            "quantity": 1
          }
        ],
        [
          {
            "id": "S0004",
            "quantity": 1
          },
          {
            "id": "S0112",
            "quantity": 1
          }
        ],
        [
          {
            "id": "S0005",
            "quantity": 2
          }
        ],
        [
          {
            "id": "S0005",
            "quantity": 1
          },
          {
            "id": "S0046",
            "quantity": 1
          }
        ],
        [
          {
            "id": "S0005",
            "quantity": 1
          },
          {
            "id": "S0112",
            "quantity": 1
          }
        ],
        [
          {
            "id": "S0046",
            "quantity": 2
          }
        ],
        [
          {
            "id": "S0046",
            "quantity": 1
          },
          {
            "id": "S0112",
            "quantity": 1
          }
        ],
        [
          {
            "id": "S0112",
            "quantity": 2
          }
        ]
      ]
    },
    {
      "id": "fertilizer",
      "category": "園芸用品",
      "result": {
        "id": "GH_FERTILIZER",
        "quantity": 1
      },
      "alternatives": [
        [
          {
            "id": "S0006",
            "quantity": 1
          },
          {
            "id": "C020",
            "quantity": 1
          },
          {
            "id": "S0036",
            "quantity": 1
          }
        ]
      ]
    }
  ]
};
