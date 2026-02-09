#!/usr/bin/env python3
"""
Convert TIGER shapefile (Census Block Groups) to GeoJSON format.
"""

import geopandas as gpd
import os
import sys

def convert_shapefile_to_geojson(shapefile_path, output_path):
    """
    Convert a shapefile to GeoJSON format.
    
    Args:
        shapefile_path: Path to the input .shp file
        output_path: Path for the output .geojson file
    """
    try:
        # Read the shapefile
        print(f"Reading shapefile: {shapefile_path}")
        gdf = gpd.read_file(shapefile_path)
        
        # Print some basic info
        print(f"Loaded {len(gdf)} features")
        print(f"CRS: {gdf.crs}")
        print(f"Columns: {list(gdf.columns)}")
        
        # Convert to GeoJSON and save
        print(f"Converting to GeoJSON: {output_path}")
        gdf.to_file(output_path, driver='GeoJSON')
        
        print(f"Successfully converted to GeoJSON!")
        print(f"Output file: {output_path}")
        
        return output_path
        
    except Exception as e:
        print(f"Error converting shapefile: {e}")
        return None

if __name__ == "__main__":
    if len(sys.argv) != 3:
        script_name = os.path.basename(sys.argv[0])
        print(f"Usage: python {script_name} <path_to_shapefile.shp> <output.geojson>")
        print("\nExample:")
        print(f"  python {script_name} tl_2023_01_bg.shp census_blocks.geojson")
        sys.exit(1)
    
    shapefile_path = sys.argv[1]
    output_path = sys.argv[2]
    
    if not os.path.exists(shapefile_path):
        print(f"Error: File not found - {shapefile_path}")
        sys.exit(1)
    
    convert_shapefile_to_geojson(shapefile_path, output_path)