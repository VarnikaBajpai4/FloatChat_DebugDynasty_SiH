import xarray as xr
import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go

# Load ARGO file
file_path = r"C:\Users\Keyur\Desktop\Misc\R1901743_209.nc"
ds = xr.open_dataset(file_path)

# Extract variables
pressure = ds["PRES"].values[0]
temperature = ds["TEMP"].values[0]
salinity = ds["PSAL"].values[0]
cycle = ds["CYCLE_NUMBER"].values[0]
float_id = ds["PLATFORM_NUMBER"].values[0]
lat = ds["LATITUDE"].values[0]
lon = ds["LONGITUDE"].values[0]

# 1. Temperature vs Depth
fig_temp = px.line(
    x=temperature, y=pressure,
    labels={"x": "Temperature (°C)", "y": "Pressure / Depth (dbar)"},
    title=f"Temperature Profile - Float {float_id} (Cycle {cycle})"
)
fig_temp.update_yaxes(autorange="reversed")
fig_temp.show()

# 2. Salinity vs Depth
fig_sal = px.line(
    x=salinity, y=pressure,
    labels={"x": "Salinity (PSU)", "y": "Pressure / Depth (dbar)"},
    title=f"Salinity Profile - Float {float_id} (Cycle {cycle})",
    color_discrete_sequence=["blue"]
)
fig_sal.update_yaxes(autorange="reversed")
fig_sal.show()

# 3. Temperature-Salinity Diagram
fig_ts = px.scatter(
    x=salinity, y=temperature,
    color=pressure,
    labels={"x": "Salinity (PSU)", "y": "Temperature (°C)", "color": "Pressure (dbar)"},
    title=f"Temperature-Salinity Diagram - Float {float_id} (Cycle {cycle})",
    color_continuous_scale="Viridis"
)
fig_ts.show()

# # 4. Heatmap of Temperature
# fig_heat_temp = px.imshow(
#     np.expand_dims(temperature, axis=0),
#     labels=dict(x="Sample Index", y="Profile", color="Temperature (°C)"),
#     title=f"Temperature Heatmap - Float {float_id} (Cycle {cycle})",
#     color_continuous_scale="RdBu_r"
# )
# fig_heat_temp.show()

# # 5. Heatmap of Salinity
# fig_heat_sal = px.imshow(
#     np.expand_dims(salinity, axis=0),
#     labels=dict(x="Sample Index", y="Profile", color="Salinity (PSU)"),
#     title=f"Salinity Heatmap - Float {float_id} (Cycle {cycle})",
#     color_continuous_scale="Viridis"
# )
# fig_heat_sal.show()

# # 6. Bar Chart - Mean Temp & Salinity by Level
# df_bars = pd.DataFrame({
#     "Pressure": pressure,
#     "Temperature": temperature,
#     "Salinity": salinity
# })

# fig_bar = go.Figure()
# fig_bar.add_trace(go.Bar(
#     x=df_bars["Pressure"], y=df_bars["Temperature"], name="Temperature (°C)", marker_color="red"
# ))
# fig_bar.add_trace(go.Bar(
#     x=df_bars["Pressure"], y=df_bars["Salinity"], name="Salinity (PSU)", marker_color="blue"
# ))
# fig_bar.update_layout(
#     barmode="group",
#     title=f"Temperature & Salinity by Depth - Float {float_id} (Cycle {cycle})",
#     xaxis_title="Pressure / Depth (dbar)",
#     yaxis_title="Value"
# )
# fig_bar.show()

# 7. Float Trajectory Map
fig_map = go.Figure()
fig_map.add_trace(go.Scattergeo(
    lon=[lon],
    lat=[lat],
    mode="markers",
    marker=dict(size=10, color="red"),
    name=f"Float {float_id}"
))
fig_map.update_layout(
    title=f"Float Trajectory - Float {float_id}",
    geo=dict(showland=True, landcolor="rgb(230,230,230)", showcountries=True)
)
fig_map.show()

print("All interactive visualizations generated successfully!")
