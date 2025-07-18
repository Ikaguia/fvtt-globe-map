let limit = {
  districts: 11
};

let colors = {
  water: 'rgb(138, 180, 248)',
  waterDeep: 'rgb(110, 160, 245)',
  waterDarker: 'rgb(  9,  64, 153)',
  road: 'rgb(185, 157,  92)',
  roadDarker: 'rgb( 90,  76,  44)',
  regionBorders: 'rgb(107,  42,  33)',
  regionLabels: 'rgb( 17,  42,  97)',
  regionLabelsOut: 'rgb(213, 195, 138)',
  nationBorders: 'rgb(170, 170, 170)',
  borderDarker: 'rgb( 74,  74,  74)',
  white: 'rgb(255, 255, 255)',
  black: 'rgb( 10,  10,  10)'
};

const fs = window.devicePixelRatio === 1 ? 1.5 : 1;

//scale font larger for lower dpr displays
const props = {
  filterMinzoom: ["get", "filterMinzoom"],
  filterMaxzoom: ["get", "filterMaxzoom"]
};

const equatorMeter2Deg = 1 / 111319.491 * 1.5; //no idea where this second factor comes from -.-

function interpolateWithCamera(base) {
  return [
    'interpolate',
    ['exponential', 2],
    ['zoom'],
    0, ['*', base, equatorMeter2Deg],
    22, ['*', base, equatorMeter2Deg * (2 ** 22)]
  ];
}

function interpolateTextWithCamera(factor) {
  return [
    'interpolate',
    ['exponential', 2],
    ['zoom'],
    0, factor * fs,
    22, factor * (2 ** 22) * fs
  ];
}

function blendInOut(from, to) {
  return ['interpolate', ['linear'], ['zoom'],
    from, 0,
    from + 0.5, 1,
    to - 0.5, 1,
    to, 0
  ];
}

function createLayer(name, base) {
  return Object.assign({
    id: base.type + '_' + name,
    source: 'golarion',
    'source-layer': name,
    filter: ['all',
      ['any', ['!', ['has', 'filterMinzoom']], ['>=', ['zoom'], props.filterMinzoom]],
      ['any', ['!', ['has', 'filterMaxzoom']], ['<=', ['zoom'], props.filterMaxzoom]]
    ]
  }, base);
}

let allLayers = [
  {
    id: 'background',
    type: 'background',
    paint: {
      'background-color': colors.waterDeep
    }
  },
  createLayer('geometry', {
    type: 'fill',
    paint: {
      'fill-color': ['get', 'color'],
      'fill-antialias': false
    }
  }),
  createLayer('province-borders', {
    type: 'line',
    minzoom: 3,
    paint: {
      'line-color': colors.nationBorders,
      'line-width': 1,
      'line-opacity': blendInOut(3,99)
    },
    layout: {
      'line-cap': 'round'
    }
  }),
  createLayer('nation-borders', {
    type: 'line',
    paint: {
      'line-color': colors.nationBorders,
      'line-width': ["interpolate", ["exponential", 2], ["zoom"],
        3, .375,
        6, 3,
      ],
    },
    layout: {
      'line-cap': 'round'
    }
  }),
  createLayer('subregion-borders', {
    type: 'line',
    maxzoom: 6,
    paint: {
      'line-color': colors.nationBorders,
      'line-width': ["interpolate", ["exponential", 2], ["zoom"],
        0, .375,
        3, 3,
      ],
    },
    layout: {
      'line-cap': 'round'
    }
  }),
  createLayer('region-borders', {
    type: 'line',
    minzoom: 2,
    maxzoom: 4,
    paint: {
      'line-color': colors.regionBorders,
      'line-width': 2,
      'line-opacity': blendInOut(2,4)
    },
    layout: {
      'line-cap': 'round'
    }
  }),
  /*
  createLayer('river-labels', {
    type: 'symbol',
    layout: {
      'symbol-placement': 'line',
      'text-max-angle': 20,
      'text-field': ['get', 'label'],
      'text-font': ['NotoSans-Medium'],
      'symbol-spacing': 300,
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5,  2,
        10, 16,
      ],
    },
    paint: {
      'text-color': colors.water,
      'text-halo-color': colors.waterDarker,
      'text-halo-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5, .125*fs,
        10, 1*fs,
      ],
    }
  }),
  createLayer('road-labels', {
    type: 'symbol',
    layout: {
      'symbol-placement': 'line',
      'text-max-angle': 20,
      'text-field': ['get', 'label'],
      'text-font': ['NotoSans-Medium'],
      'symbol-spacing': 300,
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5,  2,
        10, 16,
      ],
    },
    paint: {
      'text-color': colors.road,
      'text-halo-color': colors.roadDarker,
      'text-halo-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5, .125*fs,
        10, 1*fs,
      ],
    }
  }),*/
  createLayer('line-labels', {
    type: 'symbol',
    layout: {
      'symbol-placement': 'line',
      'text-max-angle': 20,
      'text-field': ['get', 'label'],
      'text-font': ['NotoSans-Medium'],
      'symbol-spacing': 300,
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5,  2,
        10, 16,
      ],
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': ['get', 'halo'],
      'text-halo-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        5, .125*fs,
        10, 1*fs,
      ],
    }
  }),
  createLayer('locations', {
    id: 'location-icons',
    type: 'symbol',
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-pitch-alignment': 'map',
      'icon-overlap': 'always',
      'icon-ignore-placement': true,
      'icon-size': ["interpolate", ["exponential", 2], ["zoom"],
         0,            ["^", 2, ["-", -3, props.filterMinzoom]],
         1,            ["^", 2, ["-", -2, props.filterMinzoom]],
         2, ["min", 1, ["^", 2, ["-", -1, props.filterMinzoom]]],
         3, ["min", 1, ["^", 2, ["-",  0, props.filterMinzoom]]],
         4, ["min", 1, ["^", 2, ["-",  1, props.filterMinzoom]]],
         5, ["min", 1, ["^", 2, ["-",  2, props.filterMinzoom]]],
         6, ["min", 1, ["^", 2, ["-",  3, props.filterMinzoom]]],
         7, ["min", 1, ["^", 2, ["-",  4, props.filterMinzoom]]],
         8, ["min", 1, ["^", 2, ["-",  5, props.filterMinzoom]]],
         9, ["min", 1, ["^", 2, ["-",  6, props.filterMinzoom]]],
        10, ["min", 1, ["^", 2, ["-",  7, props.filterMinzoom]]],
      ]
    },
    paint: {
    }
  }),
  createLayer('labels', {
    type: 'symbol',
    layout: {
      'text-field': ['get', 'label'],
      'text-rotate': ['get', 'angle'],
      'text-rotation-alignment': 'map',
      'text-font': ['NotoSans-Medium'],
      'text-size': 16*fs,
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': ['get', 'halo'],
      'text-halo-width': 1.5*fs
    }
  }),
  createLayer('locations', {
    id: 'location-labels',
    type: 'symbol',
    filter: ['all',
      ['>', ["zoom"], ["+", props.filterMinzoom, 3]],
      ['any', ['!', ['has', 'filterMaxzoom']], ['<=', ["zoom"], props.filterMaxzoom]]
    ],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['NotoSans-Medium'],
      'text-size': 14*fs,
      'text-variable-anchor': ["left", "right"],
      'text-radial-offset': .5,
      'text-rotation-alignment': 'map',
    },
    paint: {
      'text-color': colors.white,
      'text-halo-color': colors.black,
      'text-halo-width': .8*fs
    }
  }),
  createLayer('province-labels', {
    minzoom: 4,
    maxzoom: 7,
    type: 'symbol',
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['NotoSans-Medium'],
      'text-size': ['interpolate', ['linear'], ['zoom'],
        5, 5*fs,
        7, 20*fs,
      ],
      'text-rotation-alignment': 'map',
      'text-variable-anchor': ['center','top','bottom'],
      'symbol-z-order': 'source',
    },
    paint: {
      'text-color': colors.white,
      'text-halo-color': colors.regionLabels,
      'text-halo-width': ['interpolate', ['linear'], ['zoom'],
        5, .375*fs,
        7, 1.5*fs,
      ],
    }
  }),
  createLayer('nation-labels', {
    minzoom: 3,
    maxzoom: 6,
    type: 'symbol',
    filter: ['any',
      ['!', ['get', 'inSubregion']],
      ['>', ['zoom'], 4]
    ],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['NotoSans-Medium'],
      'text-size': ['interpolate', ['linear'], ['zoom'],
        4, 10*fs,
        5, 25*fs,
      ],
      'text-rotation-alignment': 'map',
      'text-variable-anchor': ['center','top','bottom'],
      'symbol-z-order': 'source',
    },
    paint: {
      'text-color': colors.white,
      'text-halo-color': colors.regionLabels,
      'text-halo-width': ['interpolate', ['linear'], ['zoom'],
        4, .75*fs,
        5, 1.875*fs,
      ],
    }
  }),
  createLayer('subregion-labels', {
    minzoom: 3,
    maxzoom: 5,
    type: 'symbol',
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['NotoSans-Medium'],
      'text-size': ['interpolate', ['linear'], ['zoom'],
        4, 10*fs,
        5, 25*fs,
      ],
      'text-rotation-alignment': 'map',
      'text-variable-anchor': ['center','top','bottom'],
      'symbol-z-order': 'source',
    },
    paint: {
      'text-color': colors.white,
      'text-halo-color': colors.regionLabels,
      'text-halo-width': ['interpolate', ['linear'], ['zoom'],
        4, .75*fs,
        5, 1.875*fs,
      ],
    }
  }),
  createLayer('region-labels', {
    minzoom: 1,
    maxzoom: 3,
    type: 'symbol',
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['NotoSans-Medium'],
      'text-size': 20*fs,
      'text-rotation-alignment': 'map',
      'text-variable-anchor': ['center','top','bottom'],
      'symbol-z-order': 'source',
    },
    paint: {
      'text-color': colors.regionLabels,
      'text-halo-color': colors.regionLabelsOut,
      'text-halo-width': 1.5*fs,
    }
  }),
];

function layers(options) {
  let res = allLayers;
  if (options?.get('hideLabels') === 'true') {
    res = res.filter(l => !l.id.includes('label'));
  }
  if (options?.get('hideLocations') === 'true') {
    res = res.filter(l => !l.id.includes('location'));
  }
  if (options?.get('hideBorders') === 'true') {
    res = res.filter(l => !l.id.includes('border'));
  }
  return res;
}

export default layers;
