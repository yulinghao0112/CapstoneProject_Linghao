import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  UncontrolledDropdown,
} from "reactstrap";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

function ImageList(props) {
  const [isOpen, setisOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = props.images.map((img) => img.image); // Extracting the image URLs

  const { t } = useTranslation();

  const toggleLightbox = (index) => {
    setisOpen(!isOpen);
    setCurrentImageIndex(index);
  };

  return (
    <React.Fragment>
      <ul className="list-inline message-img mb-0">
        {images.map((image, index) => (
          <li key={index} className="list-inline-item message-img-list">
            <div>
              <Link
                to="#"
                onClick={() => toggleLightbox(index)}
                className="popup-img d-inline-block m-1"
                title={`Image ${index + 1}`}
              >
                <img src={image} alt="chat" className="rounded border" />
              </Link>
            </div>
            <div className="message-img-link">
              <ul className="list-inline mb-0">
                <li className="list-inline-item">
                  <Link to="#">
                    <i className="ri-download-2-line"></i>
                  </Link>
                </li>
                <UncontrolledDropdown tag="li" className="list-inline-item">
                  <DropdownToggle tag="a">
                    <i className="ri-more-fill"></i>
                  </DropdownToggle>
                  <DropdownMenu className="dropdown-menu-end">
                    <DropdownItem>
                      {t("Copy")} <i className="ri-file-copy-line float-end text-muted"></i>
                    </DropdownItem>
                    <DropdownItem>
                      {t("Save")} <i className="ri-save-line float-end text-muted"></i>
                    </DropdownItem>
                    <DropdownItem>
                      {t("Forward")} <i className="ri-chat-forward-line float-end text-muted"></i>
                    </DropdownItem>
                    <DropdownItem>
                      {t("Delete")} <i className="ri-delete-bin-line float-end text-muted"></i>
                    </DropdownItem>
                  </DropdownMenu>
                </UncontrolledDropdown>
              </ul>
            </div>
          </li>
        ))}

        {isOpen && (
          <Lightbox
            open={isOpen}
            close={() => setisOpen(false)}
            index={currentImageIndex}
            slides={images.map((src) => ({ src }))}
          />
        )}
      </ul>
    </React.Fragment>
  );
}

export default ImageList;
