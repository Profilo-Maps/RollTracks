## Street Network Parquet Schema:
EACH ROW IN THE TABLE SHOULD CORRESPOND TO 1 STREET SEGMENT

For all columns, if a value is empty it is considered missing and should be available for public input. Exceptions are public_data_id columns, maxspeed, and geometry columns (for now).

Column titles are grouped by facility type and facility location relative to the bearing of the street centerline in the general format facility_side_n for segments and facility_start/end(_n) for point features associated with those segments. 

*Column Section Types:*
Street Centerline
Street Feature

Sidewalk Centerline
Sidewalk Feature
Crosswalks

Bikelane Centerline
Bikelane Feature

Main Geometries

**Output Parquet Format (EPSG=4326)**

*Street Centerlines*
intersection_review_flag: Bool
street_id: Str. osmid by default (stringified; may contain list of merged osmids from OSMnx simplification)
street_grid_id: Str. Grid cell + sequence ID, e.g. "12_34_0"
public_data_id_street: Str | null. if populated, Government data is being used for street centerline geometry
start_node_id: Int. OSM u by default
start_node_is_intersection_node: Bool. False by default. True if the node is shared by 3 segments.
end_node_id: Int. OSM v by default.
end_node_is_intersection_node: Bool
public_data_id_start_end_nodes: Str | null. Tuple(start node id, end node id). Only used for lookup and analysis.
normalized_bearing: Float. degrees
name: Str | null
highway: Str | null
maxspeed: Int. Should be able to configure default in case of missing value in config. Unit suffix discarded.
oneway: Str | null
lanes: Int | null
lane_width: Float | null
surface: Str | List[Str] | null. OSM multi-value tags stored as list when present.
street_condition: Str | null. Populated with OSM smoothness by default.
street_incline: Float | null. Slope percentage from USGS 3DEP elevation data.

*Street Centerline Features*
street_feature_types: Str (stringified List[Str]). parallel with street_feature_geometry multipoint.
public_data_id_street_feature: Str (stringified List[Str | null]). parallel with street_feature_geometry multipoint. If populated, Government data is being used for street_feature_geometry entry.
street_feature_geometry: GeoParquet native geometry. Multi-point
street_feature_geometry_projected: GeoParquet native geometry. Multi-point. Closest coordinate along the street segment linestring that is in line with the reported feature location. Parallel with street_feature_geometry.
street_feature_attributes: Str (stringified List[Dict|Null]). List of dictionaries of attributes for each street feature, List is parallel with street_feature_geometry multipoint.


*Sidewalk Centerlines (Left)*
sidewalk_left_ID: Str | null. Derived from street_grid_id + "L" suffix.
sidewalk_left_grid_ID: Str | null. Same as sidewalk_left_ID.
sidewalk_left_presence: Str | null. Based on OSM sidewalk:left/right/separate, left and right should be normalized based on segment bearing and osm sidewalk input should be adjusted accordingly
public_data_id_sidewalk_left: Str | null. if populated, Government data is being used for sidewalk_left_geometry
sidewalk_left_surface: Str | List[Str] | null
sidewalk_left_condition: Str | null. Populated with OSM smoothness by default.
sidewalk_left_quality: Str | null. Data quality type. Values: buffered (offset geometry from centerline), separate (OSM separate footway geometry).
sidewalk_left_width: Float | null
sidewalk_left_incline: Float | null
sidewalk_left_seperator: Str | null. Based on OSM sidewalk:*:buffer
sidewalk_left_offset: Str. "yes"/"no". Indicates that synthetic geometry was created through centerline offset.

*Curb Ramp (Left, Start, 1)*
sidewalk_left_curbramp_start_1_ID: Str | null. Sequential id assigned during network generation. Left and start are determined by normalized bearing of street section
public_data_id_sidewalk_left_curbramp_start_1: Str | null. if populated, Government data is being used for sidewalk_left_curbramp_start_1_geometry
sidewalk_left_curbramp_start_1_returnloc: Str | null. Direction of the curb return, [NW, N, NE, E, SE, S, SW, W]
sidewalk_left_curbramp_start_1_returnposition: Str | null. Position of the curb ramp on the return, [Left, Center, Right]
sidewalk_left_curbramp_start_1_condition_score: Int | null
sidewalk_left_curbramp_start_1_quality: Str | null. Data quality indicator for this curb ramp record.
sidewalk_left_curbramp_start_1_geometry: GeoParquet native geometry | null

*Curb Ramp (Left, Start, 2)*
sidewalk_left_curbramp_start_2_ID: Str | null. In case of multiple ramps with identical ID, curb return loc, and position on return
public_data_id_sidewalk_left_curbramp_start_2: Str | null
sidewalk_left_curbramp_start_2_returnloc: Str | null
sidewalk_left_curbramp_start_2_returnposition: Str | null
sidewalk_left_curbramp_start_2_condition_score: Int | null
sidewalk_left_curbramp_start_2_quality: Str | null. Data quality indicator for this curb ramp record.
sidewalk_left_curbramp_start_2_geometry: GeoParquet native geometry | null

*Curb Ramp (Left, Start, 3)*
sidewalk_left_curbramp_start_3_ID: Str | null
public_data_id_sidewalk_left_curbramp_start_3: Str | null
sidewalk_left_curbramp_start_3_returnloc: Str | null
sidewalk_left_curbramp_start_3_returnposition: Str | null
sidewalk_left_curbramp_start_3_condition_score: Int | null
sidewalk_left_curbramp_start_3_quality: Str | null. Data quality indicator for this curb ramp record.
sidewalk_left_curbramp_start_3_geometry: GeoParquet native geometry | null

*Curb Ramp (Left, End, 1)*
sidewalk_left_curbramp_end_1_ID: Str | null
public_data_id_sidewalk_left_curbramp_end_1: Str | null
sidewalk_left_curbramp_end_1_returnloc: Str | null
sidewalk_left_curbramp_end_1_returnposition: Str | null
sidewalk_left_curbramp_end_1_condition_score: Int | null
sidewalk_left_curbramp_end_1_quality: Str | null. Data quality indicator for this curb ramp record.
sidewalk_left_curbramp_end_1_geometry: GeoParquet native geometry | null

*Curb Ramp (Left, End, 2)*
sidewalk_left_curbramp_end_2_ID: Str | null
public_data_id_sidewalk_left_curbramp_end_2: Str | null
sidewalk_left_curbramp_end_2_returnloc: Str | null
sidewalk_left_curbramp_end_2_returnposition: Str | null
sidewalk_left_curbramp_end_2_condition_score: Int | null
sidewalk_left_curbramp_end_2_quality: Str | null. Data quality indicator for this curb ramp record.
sidewalk_left_curbramp_end_2_geometry: GeoParquet native geometry | null

*Curb Ramp (Left, End, 3)*
sidewalk_left_curbramp_end_3_ID: Str | null
public_data_id_sidewalk_left_curbramp_end_3: Str | null
sidewalk_left_curbramp_end_3_returnloc: Str | null
sidewalk_left_curbramp_end_3_returnposition: Str | null
sidewalk_left_curbramp_end_3_condition_score: Int | null
sidewalk_left_curbramp_end_3_quality: Str | null. Data quality indicator for this curb ramp record.
sidewalk_left_curbramp_end_3_geometry: GeoParquet native geometry | null

*Sidewalk Centerline Features (Left)*
sidewalk_left_feature_ids: Str (stringified List[Str]) | null. Sequentially assigned during network generation, parallel with sidewalk_left_feature_geometry multipoint.
sidewalk_left_feature_types: Str (stringified List[Str]) | null. parallel with sidewalk_left_feature_geometry multipoint.
public_data_id_sidewalk_left_feature: Str (stringified List[Str | null]) | null. parallel with sidewalk_left_geometry. If populated, Government data is being used for sidewalk_left_feature_geometry
sidewalk_left_feature_geometry: GeoParquet native geometry | null. Multi-point
sidewalk_left_feature_geometry_projected: GeoParquet native geometry | null. Multi-point. Closest coordinate along the sidewalk_left segment linestring that is in line with the reported feature location. Parallel with sidewalk_left_feature_geometry.


*Sidewalk Centerlines (Right)*
sidewalk_right_ID: Str | null. Derived from street_grid_id + "R" suffix.
sidewalk_right_grid_ID: Str | null. Same as sidewalk_right_ID.
sidewalk_right_presence: Str | null. Based on OSM sidewalk:right/right/separate, right and right should be normalized based on segment bearing
public_data_id_sidewalk_right: Str | null. if populated, Government data is being used for sidewalk_right_geometry
sidewalk_right_surface: Str | List[Str] | null
sidewalk_right_condition: Str | null. Populated with OSM smoothness by default.
sidewalk_right_quality: Str | null. Data quality type. Values: buffered (offset geometry from centerline), separate (OSM separate footway geometry).
sidewalk_right_width: Float | null
sidewalk_right_incline: Float | null
sidewalk_right_seperator: Str | null. Based on OSM sidewalk:*:buffer
sidewalk_right_offset: Str. "yes"/"no". Indicates that synthetic geometry was created through centerline offset.


*Curb Ramp (Right, Start, 1)*
sidewalk_right_curbramp_start_1_ID: Str | null. Sequential id assigned during network generation. right and start are determined by normalized bearing of street section
public_data_id_sidewalk_right_curbramp_start_1: Str | null. if populated, Government data is being used for sidewalk_right_curbramp_start_1_geometry
sidewalk_right_curbramp_start_1_returnloc: Str | null. Direction of the curb return, [NW, N, NE, E, SE, S, SW, W]
sidewalk_right_curbramp_start_1_returnposition: Str | null. Position of the curb ramp on the return, [Left, Center, Right]
sidewalk_right_curbramp_start_1_condition_score: Int | null
sidewalk_right_curbramp_start_1_quality: Str | null. Data quality indicator for this curb ramp record.
sidewalk_right_curbramp_start_1_geometry: GeoParquet native geometry | null

*Curb Ramp (Right, Start, 2)*
sidewalk_right_curbramp_start_2_ID: Str | null. In case of multiple ramps with identical CNN, curb return loc, and position on return
public_data_id_sidewalk_right_curbramp_start_2: Str | null
sidewalk_right_curbramp_start_2_returnloc: Str | null
sidewalk_right_curbramp_start_2_returnposition: Str | null
sidewalk_right_curbramp_start_2_condition_score: Int | null
sidewalk_right_curbramp_start_2_quality: Str | null. Data quality indicator for this curb ramp record.
sidewalk_right_curbramp_start_2_geometry: GeoParquet native geometry | null

*Curb Ramp (Right, Start, 3)*
sidewalk_right_curbramp_start_3_ID: Str | null
public_data_id_sidewalk_right_curbramp_start_3: Str | null
sidewalk_right_curbramp_start_3_returnloc: Str | null
sidewalk_right_curbramp_start_3_returnposition: Str | null
sidewalk_right_curbramp_start_3_condition_score: Int | null
sidewalk_right_curbramp_start_3_quality: Str | null. Data quality indicator for this curb ramp record.
sidewalk_right_curbramp_start_3_geometry: GeoParquet native geometry | null

*Curb Ramp (Right, End, 1)*
sidewalk_right_curbramp_end_1_ID: Str | null
public_data_id_sidewalk_right_curbramp_end_1: Str | null
sidewalk_right_curbramp_end_1_returnloc: Str | null
sidewalk_right_curbramp_end_1_returnposition: Str | null
sidewalk_right_curbramp_end_1_condition_score: Int | null
sidewalk_right_curbramp_end_1_quality: Str | null. Data quality indicator for this curb ramp record.
sidewalk_right_curbramp_end_1_geometry: GeoParquet native geometry | null

*Curb Ramp (Right, End, 2)*
sidewalk_right_curbramp_end_2_ID: Str | null
public_data_id_sidewalk_right_curbramp_end_2: Str | null
sidewalk_right_curbramp_end_2_returnloc: Str | null
sidewalk_right_curbramp_end_2_returnposition: Str | null
sidewalk_right_curbramp_end_2_condition_score: Int | null
sidewalk_right_curbramp_end_2_quality: Str | null. Data quality indicator for this curb ramp record.
sidewalk_right_curbramp_end_2_geometry: GeoParquet native geometry | null

*Curb Ramp (Right, End, 3)*
sidewalk_right_curbramp_end_3_ID: Str | null
public_data_id_sidewalk_right_curbramp_end_3: Str | null
sidewalk_right_curbramp_end_3_returnloc: Str | null
sidewalk_right_curbramp_end_3_returnposition: Str | null
sidewalk_right_curbramp_end_3_condition_score: Int | null
sidewalk_right_curbramp_end_3_quality: Str | null. Data quality indicator for this curb ramp record.
sidewalk_right_curbramp_end_3_geometry: GeoParquet native geometry | null

*Sidewalk Centerline Features (Right)*
sidewalk_right_feature_ids: Str (stringified List[Str]) | null. Sequentially assigned during network generation, parallel with sidewalk_right_feature_geometry multipoint.
sidewalk_right_feature_types: Str (stringified List[Str]) | null. parallel with sidewalk_right_feature_geometry multipoint.
public_data_id_sidewalk_right_feature: Str (stringified List[Str | null]) | null. parallel with sidewalk_right_geometry. If populated, Government data is being used for sidewalk_right_feature_geometry
sidewalk_right_feature_geometry: GeoParquet native geometry | null. Multi-point
sidewalk_right_feature_geometry_projected: GeoParquet native geometry | null. Multi-point. Closest coordinate along the sidewalk_right segment linestring that is in line with the reported feature location. Parallel with sidewalk_right_feature_geometry.

*Crosswalk (Start)*
Crosswalks are stored on the street segment being crossed (the orthogonal street), not on the sidewalk's parent street. If a street segment would have more than one crosswalk at the same end, the street is split so each sub-segment has at most one crosswalk per end. This preserves the "one grid ID = one graph edge" invariant for pathfinding.

crosswalk_start_id: Str | null. Sequentially assigned during network generation.
crosswalk_start_grid_ids: Str | null. Tuple(sidewalk_grid_id_1, sidewalk_grid_id_2) identifying the two sidewalk segments the crosswalk connects.
crosswalk_start_type: Str | null
public_data_id_crosswalk_start: Str | null. If populated, Government data is being used for crosswalk_start_geometry
crosswalk_start_controlled: Str | null
crosswalk_start_marked: Str | null
crosswalk_start_markings: Str | null
crosswalk_start_signals: Str | null. List[yes/no, button yes/no, sound yes/no, vibration yes/no, flashing_lights yes/button/sensor] (select one from each choice)
crosswalk_start_island: Str | null. yes/no
crosswalk_start_kerb: Str | null
crosswalk_start_tactile_paving: Str | null
crosswalk_start_traffic_calming: Str | null
crosswalk_start_continuous: Str | null
crosswalk_start_condition: Str | null
crosswalk_start_geometry: GeoParquet native geometry | null. LineString.
crosswalk_start_island_geometry: GeoParquet native geometry | null. MultiPoint list of crossing islands.
crosswalk_start_source: Str | null. Method of generation: case_a (footway chain), case_b (sidewalk crossing), case_c (ramp pair, cross-arm), ramp_pair (ramp pair, any arm), sw_endpoints (sidewalk endpoint fallback).
crosswalk_start_quality: Str | null. Comma-separated validation flags: ok, out_of_zone, suspect_length, synthetic. Multiple flags may be present (e.g. "out_of_zone,synthetic").

*Crosswalk (End)*
crosswalk_end_id: Str | null
crosswalk_end_grid_ids: Str | null. Tuple(sidewalk_grid_id_1, sidewalk_grid_id_2) identifying the two sidewalk segments the crosswalk connects.
crosswalk_end_type: Str | null
public_data_id_crosswalk_end: Str | null. If populated, Government data is being used for crosswalk_end_geometry
crosswalk_end_controlled: Str | null
crosswalk_end_marked: Str | null
crosswalk_end_markings: Str | null
crosswalk_end_signals: Str | null. List[yes/no, button yes/no, sound yes/no, vibration yes/no, flashing_lights yes/button/sensor] (select one from each choice)
crosswalk_end_island: Str | null. yes/no
crosswalk_end_kerb: Str | null
crosswalk_end_tactile_paving: Str | null
crosswalk_end_traffic_calming: Str | null
crosswalk_end_continuous: Str | null
crosswalk_end_condition: Str | null
crosswalk_end_geometry: GeoParquet native geometry | null. LineString.
crosswalk_end_island_geometry: GeoParquet native geometry | null. MultiPoint list of crossing islands.
crosswalk_end_source: Str | null. Method of generation: case_a (footway chain), case_b (sidewalk crossing), case_c (ramp pair, cross-arm), ramp_pair (ramp pair, any arm), sw_endpoints (sidewalk endpoint fallback).
crosswalk_end_quality: Str | null. Comma-separated validation flags: ok, out_of_zone, suspect_length, synthetic. Multiple flags may be present (e.g. "out_of_zone,synthetic").

*Bikeway Centerline (Left, 1)*
bikeway_left_1_id: Str | null. Derived from street_grid_id + "L1" suffix.
bikeway_left_1_grid_id: Str | null. Should also be called in place of bikeway_left_2_grid_id
public_data_id_bikeway_left_1: Str | null. If populated, Government data is being used for bikeway_left_1_geometry
bikeway_left_1_type: Str | List[Str] | null. Based on OSM cycleway
bikeway_left_1_surface: Str | List[Str] | null
bikeway_left_1_condition: Str | null. Populated with OSM smoothness by default.
bikeway_left_1_quality: Str | null. Data quality type. Values: buffered (offset geometry from centerline), separate (OSM separate cycleway geometry).
bikeway_left_1_permitted: Str | List[Str] | null. Based on OSM bicycle
bikeway_left_1_width: Float | null
bikeway_left_1_incline: Float | null
bikeway_left_1_seperator: Str | null. Based on OSM cycleway:*:buffer=yes
bikeway_left_1_offset: Str. "yes"/"no"

*Bikeway Centerline (Left, 2)*
bikeway_left_2_id: Str | null. In case of cycleway:left:2
public_data_id_bikeway_left_2: Str | null
bikeway_left_2_type: Str | List[Str] | null
bikeway_left_2_surface: Str | List[Str] | null
bikeway_left_2_condition: Str | null. Populated with OSM smoothness by default.
bikeway_left_2_quality: Str | null. Data quality type. Values: buffered (offset geometry from centerline), separate (OSM separate cycleway geometry).
bikeway_left_2_permitted: Str | List[Str] | null
bikeway_left_2_width: Float | null
bikeway_left_2_incline: Float | null
bikeway_left_2_seperator: Str | null
bikeway_left_2_offset: Str. "yes"/"no"

*Bikeway Centerline Features (Left, 1)*
bikeway_left_1_feature_ids: Str (stringified List[Str]) | null. parallel with bikeway_left_1_feature_geometry multipoint.
bikeway_left_1_feature_types: Str (stringified List[Str]) | null. parallel with bikeway_left_1_feature_geometry multipoint.
public_data_id_bikeway_left_1_features: Str (stringified List[Str | null]) | null. If populated, Government data is being used for bikeway_left_1_feature_geometry
bikeway_left_1_feature_geometry: GeoParquet native geometry | null. Multi-point
bikeway_left_1_feature_geometry_projected: GeoParquet native geometry | null. Multi-point. Closest coordinate along the bikeway_left_1 segment linestring that is in line with the reported feature location. Parallel with bikeway_left_1_feature_geometry.

*Bikeway Centerline Features (Left, 2)*
bikeway_left_2_feature_types: Str (stringified List[Str]) | null. parallel with bikeway_left_2_feature_geometry multipoint.
public_data_id_bikeway_left_2_features: Str (stringified List[Str | null]) | null
bikeway_left_2_feature_geometry: GeoParquet native geometry | null. Multi-point
bikeway_left_2_feature_geometry_projected: GeoParquet native geometry | null. Multi-point. Closest coordinate along the bikeway_left_2 segment linestring that is in line with the reported feature location. Parallel with bikeway_left_2_feature_geometry.

*Bikeway Centerline (Right, 1)*
bikeway_right_1_id: Str | null. Derived from street_grid_id + "R1" suffix.
bikeway_right_1_grid_id: Str | null. Should also be called in place of bikeway_right_2_grid_id
public_data_id_bikeway_right_1: Str | null. If populated, Government data is being used for bikeway_right_1_geometry
bikeway_right_1_type: Str | List[Str] | null. Based on OSM cycleway
bikeway_right_1_surface: Str | List[Str] | null
bikeway_right_1_condition: Str | null. Populated with OSM smoothness by default.
bikeway_right_1_quality: Str | null. Data quality type. Values: buffered (offset geometry from centerline), separate (OSM separate cycleway geometry).
bikeway_right_1_permitted: Str | List[Str] | null. Based on OSM bicycle
bikeway_right_1_width: Float | null
bikeway_right_1_incline: Float | null
bikeway_right_1_seperator: Str | null. Based on OSM cycleway:*:buffer=yes
bikeway_right_1_offset: Str. "yes"/"no"

*Bikeway Centerline (Right, 2)*
bikeway_right_2_id: Str | null. In case of cycleway:right:2
public_data_id_bikeway_right_2: Str | null
bikeway_right_2_type: Str | List[Str] | null
bikeway_right_2_surface: Str | List[Str] | null
bikeway_right_2_condition: Str | null. Populated with OSM smoothness by default.
bikeway_right_2_quality: Str | null. Data quality type. Values: buffered (offset geometry from centerline), separate (OSM separate cycleway geometry).
bikeway_right_2_permitted: Str | List[Str] | null
bikeway_right_2_width: Float | null
bikeway_right_2_incline: Float | List[Float] | null
bikeway_right_2_seperator: Str | null
bikeway_right_2_offset: Str. "yes"/"no"

*Bikeway Centerline Features (Right, 1)*
bikeway_right_1_feature_ids: Str (stringified List[Str]) | null. parallel with bikeway_right_1_feature_geometry multipoint.
bikeway_right_1_feature_types: Str (stringified List[Str]) | null. parallel with bikeway_right_1_feature_geometry multipoint.
public_data_id_bikeway_right_1_features: Str (stringified List[Str | null]) | null. If populated, Government data is being used for bikeway_right_1_feature_geometry
bikeway_right_1_feature_geometry: GeoParquet native geometry | null. Multi-point
bikeway_right_1_feature_geometry_projected: GeoParquet native geometry | null. Multi-point. Closest coordinate along the bikeway_right_1 segment linestring that is in line with the reported feature location. Parallel with bikeway_right_1_feature_geometry.

*Bikeway Centerline Features (Right, 2)*
bikeway_right_2_feature_types: Str (stringified List[Str]) | null. parallel with bikeway_right_2_feature_geometry multipoint.
public_data_id_bikeway_right_2_features: Str (stringified List[Str | null]) | null
bikeway_right_2_feature_geometry: GeoParquet native geometry | null. Multi-point
bikeway_right_2_feature_geometry_projected: GeoParquet native geometry | null. Multi-point. Closest coordinate along the bikeway_right_2 segment linestring that is in line with the reported feature location. Parallel with bikeway_right_2_feature_geometry.

*Main Geometry Columns (all GeoParquet native, EPSG:4326)*
street_geometry: GeoParquet native geometry (active geometry column). LineString.
start_node_geometry: GeoParquet native geometry | null. Point.
end_node_geometry: GeoParquet native geometry | null. Point.
sidewalk_left_geometry: GeoParquet native geometry | null. LineString or MultiLineString.
sidewalk_right_geometry: GeoParquet native geometry | null. LineString or MultiLineString.
curb_return_geometry: GeoParquet native geometry | null
bikeway_left_1_geometry: GeoParquet native geometry | null. LineString or MultiLineString.
bikeway_left_2_geometry: GeoParquet native geometry | null. LineString or MultiLineString.
bikeway_right_1_geometry: GeoParquet native geometry | null. LineString or MultiLineString.
bikeway_right_2_geometry: GeoParquet native geometry | null. LineString or MultiLineString.


## Data can be sourced from the following OSM tags
*OSM Sidewalk Data Format*
sidewalk:both/left/right=yes/no/separate/none
sidewalk:*:surface or sidewalk:surface
sidewalk:*:width
sidewalk:*:incline

OR (if sidewalk=separate)

footway=sidewalk
surface=*
smoothness=*
incline=*
width=*

*OSM Cycleway Data Format*
cycleway:left/right=lane/track/opposite_lane/shared_lane/share_busway/separate/no
cycleway:*:width
cycleway:*:surface
oneway:bicycle=*
bicycle=yes/no/designated/use_sidepath/dismount/private/destination

OR (if cycleway=separate)

highway=cycleway
surface=*
smoothness=*
incline=*
width=*

*OSM Crosswalk Data Format*
highway=crossing or footway=crossing
traffic_signals/uncontrolled
marked/unmarked
crossing:markings=*
crossing:signals=yes/no
button_operated=yes/no
traffic_signals:sound=yes/no
traffic_signals:vibration=yes/no
flashing_lights=yes/button/sensor
crossing:island=yes/no
kerb=*
tactile_paving=yes/no
traffic_calming=table
crossing:continuous=yes/no