'use strict';

const e = React.createElement;

class App extends React.Component {
  constructor(props) {
    super(props);
  }

  state = {
    yearlyMaxes: [],
    errorMessage: "",
    searching: false,
  }

  search(event) {
    this.setState({
      searching: true,
      yearlyMaxes: [],
    })
    fetch(`https://europe-west1-freesolarcalc.cloudfunctions.net/wave_max/?lat=${this.state.lat}&lon=${this.state.lon}`)
                    .then(response => response.json())
                    .then(data => {
                      this.state.yearlyMaxes = [];
                      for (const [key, value] of Object.entries(data)) {
                        this.state.yearlyMaxes.push({year: key, max: value});
                      }
                      this.setState({
                        latitude: this.state.lat,
                        longitude: this.state.lon,
                        yearlyMaxes: this.state.yearlyMaxes,
                        errorMessage: "",
                        searching: false,
                      });
                    })
                    .catch(event => this.setState({
                      errorMessage: "looks like we don't have data for that, try something else!",
                      searching: false,
                    }));
  }

  setLat(l) {
    if (isNaN(l)){
      this.setState({
        errorMessage: "invalid coordinate, must be numbers!",
      });
      return
    }
    if (l < -90 || l > 90) {
      this.setState({
        errorMessage: "invalid latitude! Must be between -90 and 90.",
      });
      return
    }
    this.setState({errorMessage: ""});
    this.state.lat = l;
  }

  setLon(l) {
    if (isNaN(l)){
      this.setState({
        errorMessage: "invalid coordinate, must be numbers!",
      })
      return
    }
    if (l < -180 || l > 180) {
      this.setState({
        errorMessage: "invalid latitude! Must be between -180 and 180.",
      });
      return
    }
    this.setState({errorMessage: ""});
    this.state.lon = l;
  }

  headerMessage() {
    if (this.state.errorMessage != "") {
      return `Error: ${this.state.errorMessage}`;
    }
    if (this.state.searching) {
      return "Searching...";
    }
    if (this.state.yearlyMaxes.length > 0) {
      return `Max waves for ${this.state.latitude}, ${this.state.longitude}`;
    } else {
      return "Try searching with a coordinate to get the max wave heights!";
    }
  }

  render() {
    return (
      e('div', {},
        e('center', {},
          e('label', {}, "Latitude: "),
          e('input', { onChange: (event) => { this.setLat(event.target.value) }}),
          e('label', {}, "Longitude:"),
          e('input', { onChange: (event) => { this.setLon(event.target.value) }}),
          e('button', { onClick: () => { this.search() }, disabled: this.state.searching }, 'Search'),
          e('h1', {}, this.headerMessage()),
          e('ul', {}, this.state.yearlyMaxes.map((yearlyMax) =>
            e('li', {}, `Year: ${yearlyMax.year}, Max wave height: ${yearlyMax.max}`)
          ))
        )
      )
    )
  }
}

const domContainer = document.querySelector('#site_container');
ReactDOM.render(e(App), domContainer);
