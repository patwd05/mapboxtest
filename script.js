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
  fetch('Student2.geojson')
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
      fetch('Schools2.geojson')
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
                      .setHTML(`<h3>${feature.properties['School Name']}</h3>
                                <p><strong>Shool Type:</strong> ${feature.properties['Grouped School Levels']}</p>
                                <p><strong>Facility Condition:</strong> ${feature.properties['FCI Group']}</p>
                                <p><strong>Utilization:</strong> ${feature.properties['Utilization Group']}</p>
                                <p><strong>Utilization:</strong> ${feature.properties.Utilization}</p>`)
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
              'circle-radius': 0,
              'circle-color': '#000000',
              'circle-stroke-width': 0,
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
        option.textContent = school.properties['School Name'];
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
    let categoryCounts = {};

    mpsStudentData.features.forEach(feature => {
        if (!feature.geometry || !feature.geometry.coordinates) {
            console.warn("Skipping invalid student feature:", feature);
            return;
        }

        const studentPoint = turf.point(feature.geometry.coordinates);
        const inside = turf.booleanPointInPolygon(studentPoint, isochroneData.features[0]);

        if (inside) {
            studentCount++;
            let category = feature.properties?.["USER_STU_4"] || "Unknown";
            categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        }
    });

    console.log(`Total Students in Isochrone: ${studentCount}`);
    console.log("Breakdown by USER_STU_4:", categoryCounts);

    let panel = document.getElementById('student-info-panel');
    if (!panel) {
        addStudentInfoPanel();
        panel = document.getElementById('student-info-panel');
    }

    panel.innerHTML = `<p><strong>Total Students in Isochrone:</strong> ${studentCount}</p><canvas id="studentChart"></canvas>`;
    
    let chartCanvas = document.getElementById("studentChart");
    chartCanvas.style.width = "300px";
    chartCanvas.style.height = "300px";
    chartCanvas.style.display = "block";
    chartCanvas.style.margin = "10px auto";

    renderPieChart(categoryCounts);
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
        panel.style.width = '350px';
        panel.style.textAlign = 'center';
        panel.style.maxHeight = '800px';
        panel.style.overflowY = 'auto';
        document.body.appendChild(panel);
    } else {
        panel.style.display = 'block';
    }
}

// ✅ Function to Render Pie Chart
function renderPieChart(data) {
    let ctx = document.getElementById('studentChart').getContext('2d');
    if (window.studentChartInstance) {
        window.studentChartInstance.destroy();
    }

    const categoryColors = {
        "African-American": "#A7C7E7",
        "Hispanic": "#B0E57C",
        "White": "#FAF3A7",
        "Asian": "#F8C8DC",
        "Multiple": "#D8BFD8",
        "Native American": "#FFD1A4",
        "HI/PI": "#A0E6DA"
    };

    const labels = Object.keys(data);
    const datasetColors = labels.map(label => categoryColors[label] || "gray");

    window.studentChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: Object.values(data),
                backgroundColor: datasetColors,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
        }
    });
}
// ✅ Function to Identify Schools in Isochrone and Count Students
function filterSchoolsByIsochrone(isochroneData) {
    if (!schoolData || !mpsStudentData) return;
    
    let schoolCounts = {};

    mpsStudentData.features.forEach(student => {
        if (!student.geometry || !student.geometry.coordinates) return;
        const studentPoint = turf.point(student.geometry.coordinates);
        if (turf.booleanPointInPolygon(studentPoint, isochroneData.features[0])) {
            const schoolName = student.properties['USER_ATT_1'];
            if (schoolName) {
                schoolCounts[schoolName] = (schoolCounts[schoolName] || 0) + 1;
            }
        }
    });
    
    schoolData.features = schoolData.features.filter(school => schoolCounts[school.properties['School Nam']]);
    schoolData.features.forEach(school => {
        school.properties.studentCount = schoolCounts[school.properties['School Nam']] || 0;
    });
    
    updateSchoolLayer(schoolData);
}

// ✅ Function to Update School Layer with Graduated Symbols
function updateSchoolLayer(data) {
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
            'circle-radius': [
                'interpolate', ['linear'], ['get', 'studentCount'],
                0, 5,
                50, 15,
                100, 25
            ],
            'circle-color': '#007cbf',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#FFFFFF'
        }
    });
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
          let schoolList = schoolsInIsochrone.map(school => `${school.properties['School Name']} - ${school.properties.Utilization}`).join('<br>');
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
  