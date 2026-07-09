document.addEventListener("DOMContentLoaded", () => {

    const calculator = document.querySelector(".tile-calculator");

    if (!calculator) return;

    const openButton = calculator.querySelector("[data-open-calculator]");
    const closeButton = calculator.querySelector("[data-close-calculator]");
    const modal = calculator.querySelector(".tile-calculator-modal");

    function openModal() {
        modal.hidden = false;
        document.body.classList.add("calculator-open");
    }

    function closeModal() {
        modal.hidden = true;
        document.body.classList.remove("calculator-open");
    }

    openButton.addEventListener("click", openModal);

    closeButton.addEventListener("click", closeModal);

    modal.addEventListener("click", (event) => {
        if (event.target.classList.contains("tile-calculator-overlay")) {
            closeModal();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeModal();
        }
    });

});