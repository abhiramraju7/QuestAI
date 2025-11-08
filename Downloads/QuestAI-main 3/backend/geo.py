from typing import Dict, List, Tuple

import h3

# Rough bounding box around Atlanta, GA
# min_lat, min_lng, max_lat, max_lng
ATL_BBOX: Tuple[float, float, float, float] = (33.64, -84.55, 33.90, -84.25)


def latlng_to_h3(lat: float, lng: float, resolution: int) -> str:
    # h3 v4: latlng_to_cell replaces geo_to_h3
    return h3.latlng_to_cell(lat, lng, resolution)


def _bbox_to_polygon(min_lat: float, min_lng: float, max_lat: float, max_lng: float) -> Dict:
    # GeoJSON polygon uses [lng, lat] and first == last coordinate
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [min_lng, min_lat],
                [max_lng, min_lat],
                [max_lng, max_lat],
                [min_lng, max_lat],
                [min_lng, min_lat],
            ]
        ],
    }


def atlanta_hexes(resolution: int) -> List[str]:
    min_lat, min_lng, max_lat, max_lng = ATL_BBOX
    poly = _bbox_to_polygon(min_lat, min_lng, max_lat, max_lng)
    # h3 v4: polygon_to_cells replaces polyfill
    return list(h3.polygon_to_cells(poly, resolution))


