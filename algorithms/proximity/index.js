import { Controller } from "./controllers/controller.js";
import { CSVHandler } from "./csvHandler.js";

const getRandomPoints = (amount, width, height) => {
  const points = [];
  for (let i = 0; i < amount; i++) {
    points.push([Math.random() * width, Math.random() * height]);
  }
  return points;
};

window.addEventListener("load", () => {
  const header = document.getElementsByTagName("header")[0];
  const headerHeight = header.offsetHeight;
  const svgTranslate = { x: 0, y: headerHeight };

  const hostEl = document.getElementById("viz-host");
  hostEl.style.height = `${window.innerHeight - svgTranslate.y}px`;

  const csvHandler = new CSVHandler();
  const interactiveClient = new Controller(hostEl);
  const { width, height } = hostEl.getBoundingClientRect();
  interactiveClient.updatePoints(getRandomPoints(100, width, height));

  document.getElementById("bs").addEventListener("change", (e) => {
    interactiveClient.changeGraph("bs");

    document.querySelector('input[name="beta"]').addEventListener("change", (e) => {
      interactiveClient.updateBeta(Number(e.target.value));
    });
  });

  document.getElementById("rng").addEventListener("change", (e) => {
    interactiveClient.changeGraph("rng");
  });

  document.getElementById("nn").addEventListener("change", (e) => {
    interactiveClient.changeGraph("nn");

    document.querySelector('input[name="knn"]').addEventListener("change", (e) => {
      interactiveClient.updateKnn(Number(e.target.value));
    });
  });

  document.getElementById("rknn").addEventListener("change", (e) => {
    interactiveClient.changeGraph("rknn");

    document.querySelector('input[name="knn"]').addEventListener("change", (e) => {
      interactiveClient.updateKnn(Number(e.target.value));
    });

    document.querySelector('input[name="rankThreshold"]').addEventListener("change", (e) => {
      interactiveClient.updateRankThreshold(Number(e.target.value));
    });
  });

  document.querySelector('input[name="pointSize"]').addEventListener("change", (e) => {
    interactiveClient.updatePointRadius(Number(e.target.value));
  });

  document.querySelector('input[name="edgeWidt"]').addEventListener("change", (e) => {
    interactiveClient.updateEdgeWidth(Number(e.target.value));
  });

  const inputEl = document.querySelector("input[name=csvFile]");
  const dropZoneEl = document.querySelector(".drop-zone");
  dropZoneEl.addEventListener("click", (e) => inputEl.click());

  inputEl.addEventListener("change", (e) => {
    if (inputEl.files.length) {
      csvHandler.loadFile(e.dataTransfer.files[0]).then(({ points }) => {
        interactiveClient.updatePoints(points);
      });
    }
  });

  dropZoneEl.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  dropZoneEl.addEventListener("drop", (e) => {
    e.preventDefault();

    if (e.dataTransfer.files.length) {
      inputEl.files = e.dataTransfer.files;
      csvHandler.loadFile(e.dataTransfer.files[0]).then(loadNewPoints);
    }
  });

  // Activate default graph
  interactiveClient.draw();

  // Disable slow algorithms on big data
  var betaSkeletonRadio = document.getElementById("bs");
  var rngRadio = document.getElementById("rng");
  var knnRadio = document.getElementById("nn");
  const loadNewPoints = ({ points }) => {
    const isBigData = points.length >= 1000;
    betaSkeletonRadio.disabled = isBigData ? true : false;
    rngRadio.disabled = isBigData ? true : false;

    if (betaSkeletonRadio.checked || rngRadio.checked) {
      knnRadio.checked = true;
      knnRadio.dispatchEvent(new Event("change", {}));
    }

    interactiveClient.updatePoints(points);
  };
});
