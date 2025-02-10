// ✅ Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1IjoicGF0d2QwNSIsImEiOiJjbTZ2bGVhajIwMTlvMnFwc2owa3BxZHRoIn0.moDNfqMUolnHphdwsIF87w';

// ✅ Include Turf.js
const turf = window.turf || {};
if (!turf.point) {
    const turfScript = document.createElement('script');
    turfScript.src = "https://unpkg.com/@turf/turf@6/turf.min.js";
    turfScript.onload = () => console.log("Turf.js loaded successfully.");
    document.head.appendChild(turfScript);
}
// ✅ Initialize Map
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-87.90848406343714, 43.035706452397434],
    zoom: 10.5
  });
  
  // ✅ Add Map Controls
  map.addControl(new mapboxgl.NavigationControl(), 'top-right');
  map.addControl(new mapboxgl.FullscreenControl());
  map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true
  }));
  
  // ✅ Global Variables
  let isochroneEnabled = false;
  let schoolData = null;
  
  // ✅ Load Map and Layers
  map.on('load', () => {
      addSchoolLayer();
  });
  
  // ✅ Load MPS Student Data
  fetch('MPSStudent.geojson')
      .then(response => response.json())
      .then(data => {
          mpsStudentData = data;
          console.log("MPS Student Data Loaded:", mpsStudentData);
          addMPSStudentLayer();
      })
      .catch(error => console.error("Error loading MPS student data:", error));
  
  // ✅ Function to Toggle Basemap
  document.querySelectorAll('input[name="basemap"]').forEach(input => {
      input.addEventListener('change', (event) => {
          const style = event.target.value === 'satellite' 
              ? 'mapbox://styles/mapbox/satellite-streets-v11' 
              : 'mapbox://styles/mapbox/light-v11';
          
          map.setStyle(style);
          map.once('style.load', () => {
              addSchoolLayer();
          });
      });
  });
  
  // ✅ Function to Fetch and Display Schools
  function addSchoolLayer() {
      fetch('data1.geojson')
          .then(response => response.json())
          .then(data => {
              schoolData = data;
  
              if (map.getSource('schools')) {
                  map.removeLayer('school-layer');
                  map.removeSource('schools');
              }
  
              map.addSource('schools', { type: 'geojson', data: data });
  
              map.addLayer({
                  id: 'school-layer',
                  type: 'circle',
                  source: 'schools',
                  paint: {
                      'circle-radius': 8,
                      'circle-color': ['match', ['get', 'SchoolType'], 'Vacant', '#FF0000', 'Traditional', '#00FF00', '#007cbf'],
                      'circle-stroke-width': 2,
                      'circle-stroke-color': '#FFFFFF'
                  }
              });
  
              map.on('click', 'school-layer', (e) => {
                  const feature = e.features[0];
                  const coordinates = feature.geometry.coordinates;
  
                  new mapboxgl.Popup()
                      .setLngLat(coordinates)
                      .setHTML(`<h3>${feature.properties['School Nam']}</h3>
                                <p><strong>School Type:</strong> ${feature.properties.SchoolType}</p>
                                <p><strong>Grouped Sc:</strong> ${feature.properties['Grouped Sc']}</p>
                                <p><strong>Construction Year:</strong> ${feature.properties.Constructi}</p>`)
                      .addTo(map);
                  addIsochrone(coordinates[0], coordinates[1]);
              });
  
              populateSchoolDropdown();
              applyFilters();
          });
  }
  
  // ✅ Function to Add MPS Student Layer
  function addMPSStudentLayer() {
      if (!mpsStudentData) return;
  
      if (map.getSource('mps-students')) {
          map.removeLayer('mps-student-layer');
          map.removeSource('mps-students');
      }
  
      map.addSource('mps-students', { type: 'geojson', data: mpsStudentData });
  
      map.addLayer({
          id: 'mps-student-layer',
          type: 'circle',
          source: 'mps-students',
          paint: {
              'circle-radius': .01,
              'circle-color': '#000000',
              'circle-stroke-width': 1,
              'circle-stroke-color': '#000000'
          }
      });
  }
  // ✅ Function to Populate School Dropdown
  function populateSchoolDropdown() {
    const schoolDropdown = document.getElementById("schoolDropdown");
    schoolDropdown.innerHTML = '<option value="">-- Select a school --</option>';
  
    schoolData.features.forEach(school => {
        const option = document.createElement("option");
        option.value = JSON.stringify(school.geometry.coordinates);
        option.textContent = school.properties['School Nam'];
        schoolDropdown.appendChild(option);
    });
  }
  
  // ✅ Function to Zoom to Selected School
  document.getElementById("schoolDropdown").addEventListener("change", (event) => {
    if (!event.target.value) return;
    const coordinates = JSON.parse(event.target.value);
    map.flyTo({ center: coordinates, zoom: 14 });
  });
 // ✅ Function to Identify and Count MPS Students in Isochrone
function countMPSStudentsInIsochrone(isochroneData) {
    if (!mpsStudentData || !isochroneData.features) {
        console.error("Error: MPS Student Data or Isochrone Data is missing.");
        return;
    }

    let studentCount = 0;
    let totalStudentSum = 0;

    mpsStudentData.features.forEach(feature => {
        if (!feature.geometry || !feature.geometry.coordinates) {
            console.warn("Skipping invalid student feature:", feature);
            return;
        }

        const studentPoint = turf.point(feature.geometry.coordinates);
        const inside = turf.booleanPointInPolygon(studentPoint, isochroneData.features[0]);
        
        console.log(`Student at ${feature.geometry.coordinates}: Inside Isochrone? ${inside}`);

        if (inside) {
            studentCount++;
            totalStudentSum += feature.properties?.["JOIN_COUNT"] ? feature.properties["JOIN_COUNT"] : 0;
        }
    });

    console.log(`Students in Isochrone: ${studentCount}, Total Count Sum: ${totalStudentSum}`);

    let panel = document.getElementById('student-info-panel');
    if (!panel) {
        addStudentInfoPanel();
        panel = document.getElementById('student-info-panel');
    }

    panel.innerHTML = `<p><strong>Students in Isochrone:</strong> ${studentCount}</p>
                       <p><strong>Total Student Count:</strong> ${totalStudentSum}</p>`;
}

// ✅ Function to Add Student Info Panel
function addStudentInfoPanel() {
    let panel = document.getElementById('student-info-panel');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'student-info-panel';
        panel.style.position = 'absolute';
        panel.style.bottom = '10px';
        panel.style.right = '10px';
        panel.style.backgroundColor = 'white';
        panel.style.padding = '10px';
        panel.style.border = '1px solid black';
        panel.style.zIndex = '1000';
        panel.style.display = 'block';
        panel.innerHTML = `<p><strong>Students in Isochrone:</strong> 0</p>
                           <p><strong>Total Student Count:</strong> 0</p>`;
        document.body.appendChild(panel);
    } else {
        panel.style.display = 'block';
    }
}

  
  // ✅ Function to Fetch and Display Isochrone
  function addIsochrone(lng, lat) {
      if (!isochroneEnabled) return;
      const isoUrl = `https://api.mapbox.com/isochrone/v1/mapbox/walking/${lng},${lat}?contours_meters=1600&polygons=true&access_token=${mapboxgl.accessToken}`;
  
      fetch(isoUrl)
          .then(response => response.json())
          .then(data => {
              if (!data || !data.features) {
                  console.error("Invalid Isochrone response.");
                  return;
              }
              if (map.getLayer('isochrone-layer')) {
                  map.removeLayer('isochrone-layer');
                  map.removeSource('isochrone');
              }
              map.addSource('isochrone', { type: 'geojson', data: data });
              map.addLayer({
                  id: 'isochrone-layer',
                  type: 'fill',
                  source: 'isochrone',
                  paint: {
                      'fill-color': '#007cbf',
                      'fill-opacity': 0.3
                  }
              });
  
              identifySchoolsInIsochrone(data, lng, lat);
              countMPSStudentsInIsochrone(data, lng, lat);
          })
          .catch(error => console.error('Error fetching isochrone:', error));
  }
  
  // ✅ Ensure Clicking Inside Isochrone Displays Popups
  map.on('click', 'isochrone-layer', (e) => {
      const isochroneSource = map.getSource('isochrone');
      if (isochroneSource) {
          const isochroneData = isochroneSource._data;
          identifySchoolsInIsochrone(isochroneData, e.lngLat.lng, e.lngLat.lat);
      }
  });
  
  // ✅ Identify Schools Inside Isochrone and Display in Popup
  function identifySchoolsInIsochrone(isochroneData, lng, lat) {
      if (!schoolData) return;
      const schoolsInIsochrone = schoolData.features.filter(school => {
          const schoolPoint = turf.point(school.geometry.coordinates);
          return turf.booleanPointInPolygon(schoolPoint, isochroneData.features[0]);
      });
      if (schoolsInIsochrone.length > 0) {
          let schoolList = schoolsInIsochrone.map(school => `${school.properties['School Nam']} - ${school.properties.Constructi}`).join('<br>');
          new mapboxgl.Popup()
              .setLngLat([lng, lat])
              .setHTML(`<h3>Schools in Isochrone</h3><p>${schoolList}</p>`)
              .addTo(map);
      }
  }
  
  // ✅ Function to Apply Filters
  document.querySelectorAll('input[name="schoolType"], input[name="groupedSc"]').forEach(input => {
      input.addEventListener('change', applyFilters);
  });
  
  function applyFilters() {
      if (!map.getLayer('school-layer')) return;
  
      const selectedType = document.querySelector('input[name="schoolType"]:checked').value;
      const selectedGroup = document.querySelector('input[name="groupedSc"]:checked').value;
  
      const filter = ['all'];
      if (selectedType !== 'all') filter.push(["==", ["get", "SchoolType"], selectedType]);
      if (selectedGroup !== 'all') filter.push(["==", ["get", "Grouped Sc"], selectedGroup]);
  
      map.setFilter('school-layer', filter);
  }
  
  // ✅ Load Control Panel on Page Load
document.addEventListener('DOMContentLoaded', addStudentInfoPanel);

  // ✅ Toggle Isochrone Functionality
  document.getElementById('toggleIsochrone').addEventListener('change', (e) => {
      isochroneEnabled = e.target.checked;
  
      if (!isochroneEnabled && map.getLayer('isochrone-layer')) {
          map.removeLayer('isochrone-layer');
          map.removeSource('isochrone');
      }
  });
  